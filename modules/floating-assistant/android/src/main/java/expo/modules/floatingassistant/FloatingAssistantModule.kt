package expo.modules.floatingassistant

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.File
import java.lang.ref.WeakReference

object FloatingEvents {
  var sink: ((Map<String, Any>) -> Unit)? = null
  fun emit(event: Map<String, Any>) { Handler(Looper.getMainLooper()).post { sink?.invoke(event) } }
}

class FloatingAssistantModule : Module() {
  private var permissionPromise: Promise? = null
  private val requestCode = 9341

  override fun definition() = ModuleDefinition {
    Name("FloatingAssistant")
    Events("onAction")
    OnCreate {
      val reference = WeakReference(this@FloatingAssistantModule)
      FloatingEvents.sink = { event -> reference.get()?.sendEvent("onAction", event) }
    }
    OnDestroy {
      FloatingEvents.sink = null
      permissionPromise?.resolve(false)
      permissionPromise = null
      Handler(Looper.getMainLooper()).post { FloatingAssistantService.instance?.stopSelf() }
    }
    Function("isEnabled") { FloatingAssistantService.instance?.ready == true }
    AsyncFunction("requestOverlayPermission") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) promise.reject("E_ACTIVITY", "Open GabAI to enable the assistant.", null)
      else if (Settings.canDrawOverlays(activity)) promise.resolve(true)
      else if (permissionPromise != null) promise.reject("E_PERMISSION_PENDING", "Overlay permission is already open.", null)
      else {
        permissionPromise = promise
        try {
          activity.startActivityForResult(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${activity.packageName}")), requestCode)
        } catch (error: Exception) {
          permissionPromise = null
          promise.reject("E_OVERLAY_PERMISSION", error.message, error)
        }
      }
    }.runOnQueue(Queues.MAIN)
    OnActivityResult { activity, result ->
      if (result.requestCode == requestCode) {
        permissionPromise?.resolve(Settings.canDrawOverlays(activity))
        permissionPromise = null
      }
    }
    AsyncFunction("start") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null || !Settings.canDrawOverlays(context)) {
        promise.reject("E_OVERLAY_PERMISSION", "Allow GabAI to display over other apps, then tap the power button again.", null)
      } else if (FloatingAssistantService.instance?.ready == true) {
        promise.resolve(null)
      } else try {
        context.startForegroundService(Intent(context, FloatingAssistantService::class.java))
        val handler = Handler(Looper.getMainLooper())
        val deadline = android.os.SystemClock.uptimeMillis() + 3000
        val checkReady = object : Runnable {
          override fun run() {
            if (FloatingAssistantService.instance?.ready == true) promise.resolve(null)
            else if (android.os.SystemClock.uptimeMillis() >= deadline) {
              FloatingAssistantService.instance?.stopSelf()
              promise.reject("E_OVERLAY_START", "GabAI could not start. Check overlay permission and try again.", null)
            } else handler.postDelayed(this, 50)
          }
        }
        handler.post(checkReady)
      } catch (error: Exception) {
        promise.reject("E_OVERLAY_START", "GabAI could not start. Check overlay permission and try again.", error)
      }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("stop") { FloatingAssistantService.instance?.stopSelf() }.runOnQueue(Queues.MAIN)
    AsyncFunction("updateChat") { snapshot: String ->
      JSONObject(snapshot).optJSONObject("labels")?.let { FloatingStrings.update(it) }
      FloatingAssistantService.instance?.updateChat(snapshot)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("discardCapture") { uri: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      val file = File(Uri.parse(uri).path ?: return@AsyncFunction).canonicalFile
      val folder = File(context.cacheDir, "gabai-captures").canonicalFile
      if (file.parentFile == folder && file.name.startsWith("crop-") && file.extension == "png") file.delete()
    }
  }
}
