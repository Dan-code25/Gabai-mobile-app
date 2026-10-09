package expo.modules.offlineocr

import android.graphics.Rect
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean

class OfflineOcrModule : Module() {
  private val recognizerLock = Any()
  private var recognizer: TextRecognizer? = null
  private var activeRequests = 0
  private var destroyed = false

  override fun definition() = ModuleDefinition {
    Name("OfflineOcr")

    // Preserve the original string API for existing callers.
    AsyncFunction("recognizeText") { imageUri: String, promise: Promise ->
      extract(imageUri, promise, structured = false)
    }

    AsyncFunction("recognizeDocument") { imageUri: String, promise: Promise ->
      extract(imageUri, promise, structured = true)
    }

    OnDestroy {
      synchronized(recognizerLock) {
        destroyed = true
        closeRecognizerIfIdle()
      }
    }
  }

  // Expo dispatches these AsyncFunctions off the JS thread, including decoding.
  private fun extract(imageUri: String, promise: Promise, structured: Boolean) {
    val context = appContext.reactContext
    if (context == null) {
      promise.reject("E_OCR_CONTEXT", "The Android app context is unavailable.", null)
      return
    }

    val uri = Uri.parse(imageUri)
    if (uri.scheme != "file" && uri.scheme != "content") {
      promise.reject("E_OCR_URI", "Choose a local image with a file:// or content:// URI.", null)
      return
    }

    val image = try {
      // Keep URI access and EXIF orientation handling for gallery/cropped files.
      InputImage.fromFilePath(context, uri)
    } catch (error: Exception) {
      promise.reject("E_OCR_IMAGE", "Cannot open the selected image: ${error.message}", error)
      return
    }

    val client = try {
      synchronized(recognizerLock) {
        check(!destroyed) { "The OCR module has been closed." }
        val shared = recognizer ?: TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
          .also { recognizer = it }
        activeRequests += 1
        shared
      }
    } catch (error: Exception) {
      promise.reject("E_OCR_INIT", "Cannot initialize text recognition: ${error.message}", error)
      return
    }

    // A request releases ownership once, including cancellation/synchronous failure.
    val completed = AtomicBoolean(false)
    val finish = {
      if (completed.compareAndSet(false, true)) {
        synchronized(recognizerLock) {
          activeRequests -= 1
          closeRecognizerIfIdle()
        }
      }
    }

    try {
      client.process(image)
        .addOnSuccessListener { result ->
          try {
            if (structured) promise.resolve(documentResult(result))
            else promise.resolve(result.text)
          } catch (error: Exception) {
            promise.reject("E_OCR_RESULT", "Cannot read the recognition result: ${error.message}", error)
          }
        }
        .addOnFailureListener { error ->
          promise.reject("E_OCR_FAILED", "Text recognition failed: ${error.message}", error)
        }
        .addOnCanceledListener {
          promise.reject("E_OCR_CANCELED", "Text recognition was canceled. Try again.", null)
        }
        .addOnCompleteListener { finish() }
    } catch (error: Exception) {
      finish()
      promise.reject("E_OCR_FAILED", "Text recognition failed: ${error.message}", error)
    }
  }

  // Called under recognizerLock. Do not close a client that still owns a scan.
  private fun closeRecognizerIfIdle() {
    if (destroyed && activeRequests == 0) {
      recognizer?.close()
      recognizer = null
    }
  }

  private fun bounds(rect: Rect?): Map<String, Int>? = rect?.let {
    mapOf("left" to it.left, "top" to it.top, "right" to it.right, "bottom" to it.bottom)
  }

  private fun documentResult(result: Text): Map<String, Any?> = mapOf(
    "rawText" to result.text,
    "blocks" to result.textBlocks.map { block ->
      mapOf(
        "text" to block.text,
        "bounds" to bounds(block.boundingBox),
        "lines" to block.lines.map { line ->
          mapOf("text" to line.text, "bounds" to bounds(line.boundingBox))
        }
      )
    }
  )
}
