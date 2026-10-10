package expo.modules.floatingassistant

import android.content.Context
import android.graphics.*
import android.view.MotionEvent
import android.view.View
import kotlin.math.*

/** Selection coordinates are mapped through the displayed image's fit-center scale. */
class CropSelectionView(context: Context, private val bitmap: Bitmap) : View(context) {
  private val image = RectF()
  private val selection = RectF()
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
  private var startX = 0f
  private var startY = 0f
  private var corner = -1
  private var scale = 1f
  private val density = resources.displayMetrics.density

  init { contentDescription = FloatingStrings.t("Screenshot crop. Drag to select an area, or drag a corner to adjust.") }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    scale = min(w.toFloat() / bitmap.width, h.toFloat() / bitmap.height)
    val left = (w - bitmap.width * scale) / 2
    val top = (h - bitmap.height * scale) / 2
    image.set(left, top, left + bitmap.width * scale, top + bitmap.height * scale)
    selection.set(image)
  }

  override fun onDraw(canvas: Canvas) {
    paint.color = Color.WHITE; paint.style = Paint.Style.FILL
    canvas.drawBitmap(bitmap, null, image, paint)
    canvas.save(); canvas.clipOutRect(selection)
    paint.color = Color.argb(150, 17, 17, 53); canvas.drawRect(image, paint); canvas.restore()
    paint.color = Color.rgb(89, 64, 237); paint.style = Paint.Style.STROKE; paint.strokeWidth = 3 * density
    canvas.drawRect(selection, paint)
    paint.style = Paint.Style.FILL
    corners().forEach { canvas.drawCircle(it.first, it.second, 7 * density, paint) }
  }

  private fun corners() = listOf(Pair(selection.left, selection.top), Pair(selection.right, selection.top), Pair(selection.right, selection.bottom), Pair(selection.left, selection.bottom))

  override fun onTouchEvent(event: MotionEvent): Boolean {
    val x = event.x.coerceIn(image.left, image.right)
    val y = event.y.coerceIn(image.top, image.bottom)
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        startX = x; startY = y
        corner = corners().indexOfFirst { hypot(it.first - x, it.second - y) < 28 * density }
        return true
      }
      MotionEvent.ACTION_MOVE -> {
        val minimum = 16 * density
        when (corner) {
          0 -> { selection.left = min(x, selection.right - minimum).coerceAtLeast(image.left); selection.top = min(y, selection.bottom - minimum).coerceAtLeast(image.top) }
          1 -> { selection.right = max(x, selection.left + minimum).coerceAtMost(image.right); selection.top = min(y, selection.bottom - minimum).coerceAtLeast(image.top) }
          2 -> { selection.right = max(x, selection.left + minimum).coerceAtMost(image.right); selection.bottom = max(y, selection.top + minimum).coerceAtMost(image.bottom) }
          3 -> { selection.left = min(x, selection.right - minimum).coerceAtLeast(image.left); selection.bottom = max(y, selection.top + minimum).coerceAtMost(image.bottom) }
          else -> if (abs(x - startX) > minimum || abs(y - startY) > minimum) selection.set(min(startX, x), min(startY, y), max(startX, x), max(startY, y))
        }
        invalidate(); return true
      }
      MotionEvent.ACTION_UP -> { performClick(); return true }
    }
    return true
  }

  override fun performClick(): Boolean { super.performClick(); return true }

  fun crop(): Bitmap {
    val left = ((selection.left - image.left) / scale).toInt().coerceIn(0, bitmap.width - 1)
    val top = ((selection.top - image.top) / scale).toInt().coerceIn(0, bitmap.height - 1)
    val width = (selection.width() / scale).toInt().coerceIn(1, bitmap.width - left)
    val height = (selection.height() / scale).toInt().coerceIn(1, bitmap.height - top)
    return Bitmap.createBitmap(bitmap, left, top, width, height)
  }
}
