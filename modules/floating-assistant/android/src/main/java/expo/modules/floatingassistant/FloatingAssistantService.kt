package expo.modules.floatingassistant

import android.app.*
import android.content.Intent
import android.content.res.Configuration
import android.content.pm.ServiceInfo
import android.graphics.*
import android.graphics.drawable.GradientDrawable
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.*
import android.provider.Settings
import android.text.InputFilter
import android.text.InputType
import android.util.DisplayMetrics
import android.view.*
import android.view.inputmethod.InputMethodManager
import android.widget.*
import org.json.JSONObject
import java.io.File
import java.util.UUID
import kotlin.math.abs
import kotlin.math.min

class FloatingAssistantService : Service() {
  companion object { @Volatile var instance: FloatingAssistantService? = null; private const val NOTIFICATION = 9343 }
  private val main = Handler(Looper.getMainLooper())
  private val captureThread = HandlerThread("GabAI-capture")
  private lateinit var captureHandler: Handler
  private lateinit var windows: WindowManager
  private lateinit var bubble: ImageView
  private lateinit var chat: LinearLayout
  private lateinit var bubbleParams: WindowManager.LayoutParams
  private lateinit var chatParams: WindowManager.LayoutParams
  private lateinit var messageList: LinearLayout
  private lateinit var chatScroll: ScrollView
  private lateinit var statusView: TextView
  private lateinit var spinner: ProgressBar
  private lateinit var input: EditText
  private lateinit var send: Button
  private lateinit var screenshot: Button
  private var cropWindow: View? = null
  private var capturedBitmap: Bitmap? = null
  private var projection: MediaProjection? = null
  private var reader: ImageReader? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var captureRunning = false
  @Volatile private var frameAccepted = false
  private var busy = false
  private var conversationId = ""
  private var snapshot = JSONObject("{\"messages\":[],\"busy\":false,\"status\":\"Take a screenshot to get started.\"}")
  private val purple = Color.rgb(89, 64, 237)
  private val ink = Color.rgb(17, 17, 53)
  private val muted = Color.rgb(100, 99, 139)
  private val cream = Color.rgb(255, 247, 241)
  private val lavender = Color.rgb(236, 231, 255)
  private val timeout = Runnable { captureCancelled("Capture timed out. Tap Take a Screenshot to try again.") }

  override fun onBind(intent: Intent?) = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    windows = getSystemService(WindowManager::class.java)
    foreground(false)
    captureThread.start()
    captureHandler = Handler(captureThread.looper)
    try {
      check(Settings.canDrawOverlays(this)) { "Overlay permission is required." }
      bubble = ImageView(this).apply {
        setImageBitmap(assetImage("images/shiba-wave.png"))
        scaleType = ImageView.ScaleType.FIT_CENTER
        setPadding(dp(4), dp(4), dp(4), dp(4))
        background = rounded(lavender, 36, purple)
        contentDescription = "Open GabAI floating assistant. Drag to move."
        elevation = dp(6).toFloat()
      }
      bubbleParams = params(dp(72), dp(72), false).apply { x = screenSize().first - dp(84); y = screenSize().second / 4 }
      buildChat()
      bubble.setOnClickListener { showChat() }
      installDrag(bubble, bubbleParams, true) { showChat() }
      showBubble()
      FloatingEvents.emit(mapOf("type" to "enabled"))
    } catch (_: Exception) { stopSelf() }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "STOP") stopSelf()
    return START_NOT_STICKY
  }

  private fun foreground(capturing: Boolean) {
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel("gabai-assistant", "GabAI assistant", NotificationManager.IMPORTANCE_LOW))
    val stop = PendingIntent.getService(this, 1, Intent(this, javaClass).setAction("STOP"), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val notification = Notification.Builder(this, "gabai-assistant")
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle("GabAI assistant is on")
      .setContentText(if (capturing) "Capturing the screen you approved" else "Tap the Shiba to get offline help")
      .setOngoing(true).addAction(Notification.Action.Builder(null, "Stop", stop).build())
    packageManager.getLaunchIntentForPackage(packageName)?.let {
      notification.setContentIntent(PendingIntent.getActivity(this, 2, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
    }
    var type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
    if (capturing && Build.VERSION.SDK_INT >= 29) type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
    if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION, notification.build(), type)
    else startForeground(NOTIFICATION, notification.build())
  }

  private fun buildChat() {
    val size = screenSize()
    chatParams = params(min(size.first - dp(24), dp(360)), min(size.second - dp(24), dp(480)), true)
      .apply { x = (size.first - width) / 2; y = min(dp(64), size.second - height) }
    chat = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(12), dp(8), dp(12), dp(12))
      background = rounded(cream, 24, Color.WHITE)
      elevation = dp(12).toFloat()
    }
    val header = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
    header.addView(ImageView(this).apply { setImageBitmap(assetImage("images/gabai-logo.png")); contentDescription = "GabAI logo" }, LinearLayout.LayoutParams(dp(28), dp(28)))
    header.addView(text("GabAI", 20, true), LinearLayout.LayoutParams(0, dp(48), 1f).apply { leftMargin = dp(8) })
    header.addView(button("−", "Minimize GabAI") { showBubble() }, LinearLayout.LayoutParams(dp(44), dp(44)))
    header.addView(button("×", "Close window and return to floating button") { showBubble() }, LinearLayout.LayoutParams(dp(44), dp(44)))
    chat.addView(header)
    installDrag(header, chatParams, false) {}
    messageList = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    chatScroll = ScrollView(this).apply { addView(messageList); isFillViewport = true }
    chat.addView(chatScroll, LinearLayout.LayoutParams(-1, 0, 1f))
    val progress = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(4), 0, dp(4)) }
    spinner = ProgressBar(this).apply { visibility = View.GONE }
    progress.addView(spinner, LinearLayout.LayoutParams(dp(20), dp(20)).apply { rightMargin = dp(8) })
    statusView = text("Take a screenshot to get started.", 13).apply { setTextColor(muted) }
    progress.addView(statusView, LinearLayout.LayoutParams(0, -2, 1f))
    chat.addView(progress)
    val composer = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
    input = EditText(this).apply {
      hint = "Ask about this screenshot…"
      contentDescription = "Follow-up question"
      setTextColor(ink); setHintTextColor(muted); textSize = 16f
      typeface = font(false); setPadding(dp(12), dp(6), dp(12), dp(6))
      inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
      minHeight = dp(48); maxLines = 3; filters = arrayOf(InputFilter.LengthFilter(400))
      background = rounded(Color.WHITE, 16, lavender)
    }
    composer.addView(input, LinearLayout.LayoutParams(0, -2, 1f))
    send = button("Send", "Send follow-up question", true) { sendQuestion() }
    composer.addView(send, LinearLayout.LayoutParams(dp(68), dp(48)).apply { leftMargin = dp(8) })
    chat.addView(composer)
    screenshot = button("Take a Screenshot", "Capture screen after Android consent", true) { requestCapture() }
    chat.addView(screenshot, LinearLayout.LayoutParams(-1, dp(48)).apply { topMargin = dp(8) })
    renderChat()
  }

  fun updateChat(json: String) {
    val update = JSONObject(json)
    if (update.optString("conversationId") != conversationId) return
    snapshot = update
    busy = update.optBoolean("busy")
    renderChat()
  }

  private fun renderChat() {
    messageList.removeAllViews()
    val messages = snapshot.optJSONArray("messages")
    if (messages != null) for (index in 0 until messages.length()) {
      val message = messages.getJSONObject(index)
      val user = message.optString("role") == "user"
      val view = text(message.optString("text"), 16).apply {
        setPadding(dp(12), dp(10), dp(12), dp(10))
        background = rounded(if (user) lavender else Color.WHITE, 16)
        setTextIsSelectable(true)
      }
      messageList.addView(view, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8) })
    }
    statusView.text = snapshot.optString("status")
    spinner.visibility = if (busy || captureRunning) View.VISIBLE else View.GONE
    input.isEnabled = !busy && !captureRunning && conversationId.isNotEmpty() && snapshot.optBoolean("ready")
    send.isEnabled = input.isEnabled
    screenshot.isEnabled = !busy && !captureRunning
    send.alpha = if (send.isEnabled) 1f else 0.45f
    screenshot.alpha = if (screenshot.isEnabled) 1f else 0.45f
    chatScroll.post { chatScroll.fullScroll(View.FOCUS_DOWN) }
  }

  private fun sendQuestion() {
    val question = input.text.toString().trim()
    if (busy || captureRunning || question.isEmpty() || conversationId.isEmpty()) return
    busy = true
    input.setText("")
    snapshot.put("busy", true).put("status", "Thinking offline…")
    renderChat()
    FloatingEvents.emit(mapOf("type" to "question", "conversationId" to conversationId, "text" to question))
  }

  private fun requestCapture() {
    if (busy || captureRunning) return
    captureRunning = true
    snapshot.put("status", "Approve Android's screen capture prompt.")
    renderChat()
    hideKeyboard()
    remove(bubble); remove(chat)
    try { startActivity(Intent(this, CapturePermissionActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    catch (error: Exception) { captureCancelled(error.message ?: "Could not request screen capture.") }
  }

  fun captureGranted(resultCode: Int, data: Intent) {
    if (!captureRunning || instance !== this) return
    remove(bubble); remove(chat)
    // Wait for the consent host to finish and overlay removal to reach the compositor.
    main.postDelayed({
      if (instance !== this || !captureRunning) return@postDelayed
      try {
        foreground(true)
        frameAccepted = false
        val manager = getSystemService(MediaProjectionManager::class.java)
        projection = manager.getMediaProjection(resultCode, data)
        projection!!.registerCallback(object : MediaProjection.Callback() {
          override fun onStop() { if (!frameAccepted && captureRunning) captureCancelled("Screen capture stopped. Tap to try again.") }
        }, main)
        val (width, height) = captureSize()
        val imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        reader = imageReader
        imageReader.setOnImageAvailableListener({ source ->
          val image = try { source.acquireLatestImage() } catch (_: Exception) { null }
          if (image != null) {
            try {
              if (!frameAccepted) {
                frameAccepted = true
                val plane = image.planes[0]
                val paddedWidth = width + (plane.rowStride - plane.pixelStride * width) / plane.pixelStride
                val padded = Bitmap.createBitmap(paddedWidth, height, Bitmap.Config.ARGB_8888)
                padded.copyPixelsFromBuffer(plane.buffer)
                val bitmap = Bitmap.createBitmap(padded, 0, 0, width, height)
                if (bitmap !== padded) padded.recycle()
                main.post {
                  releaseProjection()
                  if (instance === this && captureRunning) showCrop(bitmap) else bitmap.recycle()
                }
              }
            } catch (error: Exception) { main.post { captureCancelled(error.message ?: "Could not read the screenshot.") } }
            finally { image.close() }
          }
        }, captureHandler)
        virtualDisplay = projection!!.createVirtualDisplay("GabAI approved screenshot", width, height,
          resources.displayMetrics.densityDpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
          imageReader.surface, null, main)
        main.postDelayed(timeout, 10000)
      } catch (error: Exception) { captureCancelled(error.message ?: "Could not capture the screen.") }
    }, 450)
  }

  fun captureCancelled(message: String) {
    captureRunning = false
    frameAccepted = true
    releaseProjection()
    capturedBitmap?.recycle(); capturedBitmap = null
    cropWindow?.let { remove(it) }; cropWindow = null
    if (instance !== this) return
    snapshot.put("status", message)
    renderChat()
    showChat()
  }

  private fun releaseProjection() {
    main.removeCallbacks(timeout)
    virtualDisplay?.release(); virtualDisplay = null
    reader?.close(); reader = null
    projection?.stop(); projection = null
    if (instance === this) foreground(false)
  }

  private fun showCrop(bitmap: Bitmap) {
    capturedBitmap = bitmap
    val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; background = rounded(cream, 0); setPadding(dp(12), dp(8), dp(12), dp(12)) }
    root.addView(text("Select the area to explain", 20, true), LinearLayout.LayoutParams(-1, dp(40)))
    root.addView(text("Drag to select. Drag a corner to adjust.", 14), LinearLayout.LayoutParams(-1, dp(36)))
    val selection = CropSelectionView(this, bitmap)
    root.addView(selection, LinearLayout.LayoutParams(-1, 0, 1f))
    val actions = LinearLayout(this)
    actions.addView(button("Cancel", "Cancel crop") { captureCancelled("Crop cancelled. Your previous chat is unchanged.") }, LinearLayout.LayoutParams(0, dp(52), 1f))
    val confirm = button("Explain area", "Crop selected area and explain offline", true) {}
    confirm.setOnClickListener {
      confirm.isEnabled = false
      val crop = selection.crop()
      capturedBitmap?.let { if (crop !== it) it.recycle() }; capturedBitmap = null
      remove(root); cropWindow = null
      captureHandler.post {
        val folder = File(cacheDir, "gabai-captures").apply { mkdirs() }
        val file = File(folder, "crop-${UUID.randomUUID()}.png")
        try {
          file.outputStream().use { check(crop.compress(Bitmap.CompressFormat.PNG, 100, it)) }
          main.post {
            if (instance !== this) { file.delete(); return@post }
            captureRunning = false; busy = true; conversationId = UUID.randomUUID().toString()
            snapshot = JSONObject("{\"messages\":[],\"busy\":true,\"status\":\"Reading screenshot offline…\"}")
            renderChat(); showChat()
            FloatingEvents.emit(mapOf("type" to "crop", "conversationId" to conversationId, "uri" to Uri.fromFile(file).toString()))
          }
        } catch (error: Exception) {
          file.delete()
          main.post { captureCancelled(error.message ?: "Could not save the crop.") }
        } finally { crop.recycle() }
      }
    }
    actions.addView(confirm, LinearLayout.LayoutParams(0, dp(52), 1f).apply { leftMargin = dp(8) })
    root.addView(actions)
    cropWindow = root
    val size = screenSize()
    try { windows.addView(root, params(size.first, size.second, false).apply { x = 0; y = 0 }) }
    catch (error: Exception) { captureCancelled(error.message ?: "Could not open the crop selector.") }
  }

  private fun showBubble() {
    hideKeyboard(); remove(chat)
    if (!bubble.isAttachedToWindow) try { clamp(bubbleParams); windows.addView(bubble, bubbleParams) } catch (_: Exception) { stopSelf() }
  }

  private fun showChat() {
    if (instance !== this) return
    remove(bubble)
    if (!chat.isAttachedToWindow) try { clamp(chatParams); windows.addView(chat, chatParams) } catch (_: Exception) { stopSelf() }
  }

  private fun installDrag(view: View, layout: WindowManager.LayoutParams, isBubble: Boolean, onTap: () -> Unit) {
    var startX = 0f; var startY = 0f; var originX = 0; var originY = 0; var dragged = false
    view.setOnTouchListener { _, event ->
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> { startX = event.rawX; startY = event.rawY; originX = layout.x; originY = layout.y; dragged = false; true }
        MotionEvent.ACTION_MOVE -> {
          val dx = event.rawX - startX; val dy = event.rawY - startY
          if (abs(dx) + abs(dy) > dp(8)) dragged = true
          if (dragged) {
            layout.x = originX + dx.toInt(); layout.y = originY + dy.toInt(); clamp(layout)
            try { windows.updateViewLayout(if (isBubble) bubble else chat, layout) } catch (_: Exception) { stopSelf() }
          }
          true
        }
        MotionEvent.ACTION_UP -> { if (!dragged) { if (!view.performClick()) onTap() }; true }
        else -> true
      }
    }
  }

  private fun params(width: Int, height: Int, focusable: Boolean) = WindowManager.LayoutParams(width, height,
    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or (if (focusable) 0 else WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE),
    PixelFormat.TRANSLUCENT).apply {
      gravity = Gravity.TOP or Gravity.LEFT
      softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
    }

  private fun clamp(layout: WindowManager.LayoutParams) {
    val size = screenSize()
    layout.x = layout.x.coerceIn(0, (size.first - layout.width).coerceAtLeast(0))
    layout.y = layout.y.coerceIn(0, (size.second - layout.height).coerceAtLeast(0))
  }

  private fun captureSize(): Pair<Int, Int> {
    if (Build.VERSION.SDK_INT >= 30) return windows.maximumWindowMetrics.bounds.let { Pair(it.width(), it.height()) }
    val metrics = DisplayMetrics(); windows.defaultDisplay.getRealMetrics(metrics)
    return Pair(metrics.widthPixels, metrics.heightPixels)
  }

  private fun screenSize(): Pair<Int, Int> {
    if (Build.VERSION.SDK_INT >= 30) {
      val metrics = windows.maximumWindowMetrics
      val insets = metrics.windowInsets.getInsetsIgnoringVisibility(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
      return Pair(metrics.bounds.width() - insets.left - insets.right, metrics.bounds.height() - insets.top - insets.bottom)
    }
    val metrics = DisplayMetrics(); windows.defaultDisplay.getMetrics(metrics)
    return Pair(metrics.widthPixels, metrics.heightPixels)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    if (!::chat.isInitialized) return
    val size = screenSize()
    chatParams.width = min(size.first - dp(24), dp(360)); chatParams.height = min(size.second - dp(24), dp(480))
    clamp(chatParams); clamp(bubbleParams)
    try {
      if (chat.isAttachedToWindow) windows.updateViewLayout(chat, chatParams)
      if (bubble.isAttachedToWindow) windows.updateViewLayout(bubble, bubbleParams)
      cropWindow?.let { windows.updateViewLayout(it, params(size.first, size.second, false)) }
    } catch (_: Exception) { stopSelf() }
  }

  private fun hideKeyboard() { if (::input.isInitialized) { getSystemService(InputMethodManager::class.java).hideSoftInputFromWindow(input.windowToken, 0); input.clearFocus() } }
  private fun remove(view: View) { if (view.isAttachedToWindow) try { windows.removeViewImmediate(view) } catch (_: Exception) {} }
  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
  private fun font(bold: Boolean) = try { Typeface.createFromAsset(assets, "fonts/Nunito-${if (bold) "Bold" else "Regular"}.ttf") } catch (_: Exception) { Typeface.DEFAULT }
  private fun text(value: String, size: Int, bold: Boolean = false) = TextView(this).apply { text = value; textSize = size.toFloat(); setTextColor(ink); typeface = font(bold); gravity = Gravity.CENTER_VERTICAL }
  private fun rounded(color: Int, radius: Int, stroke: Int? = null) = GradientDrawable().apply { setColor(color); cornerRadius = dp(radius).toFloat(); if (stroke != null) setStroke(dp(1), stroke) }
  private fun button(value: String, label: String, primary: Boolean = false, action: () -> Unit) = Button(this).apply {
    text = value; contentDescription = label; isAllCaps = false; textSize = 15f; typeface = font(true)
    setTextColor(if (primary) Color.WHITE else ink); background = rounded(if (primary) purple else lavender, 16)
    minHeight = dp(44); minimumWidth = 0; minWidth = 0; setPadding(dp(8), 0, dp(8), 0)
    setOnClickListener { action() }
  }
  private fun assetImage(path: String): Bitmap = assets.open(path).use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = 4 }) ?: error("Missing mascot") }

  override fun onDestroy() {
    instance = null
    captureRunning = false; frameAccepted = true; main.removeCallbacksAndMessages(null)
    releaseProjection()
    if (::bubble.isInitialized) remove(bubble)
    if (::chat.isInitialized) { hideKeyboard(); remove(chat) }
    cropWindow?.let { remove(it) }; cropWindow = null
    capturedBitmap?.recycle(); capturedBitmap = null
    captureThread.quitSafely()
    stopForeground(STOP_FOREGROUND_REMOVE)
    FloatingEvents.emit(mapOf("type" to "stopped"))
    super.onDestroy()
  }
}
