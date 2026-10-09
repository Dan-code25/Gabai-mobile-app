package expo.modules.floatingassistant

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle

/** Transparent permission host: returns to the current app before capturing. */
class CapturePermissionActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (savedInstanceState != null) {
      FloatingAssistantService.instance?.captureCancelled("Screen capture interrupted. Tap to try again.")
      finish(); return
    }
    val manager = getSystemService(MediaProjectionManager::class.java)
    val request = if (Build.VERSION.SDK_INT >= 34)
      manager.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay())
    else manager.createScreenCaptureIntent()
    try { startActivityForResult(request, 9342) }
    catch (error: Exception) {
      FloatingAssistantService.instance?.captureCancelled(error.message ?: "Screen capture could not start.")
      finish()
    }
  }

  @Deprecated("Activity result used only by this small native permission host")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != 9342) return
    val assistant = FloatingAssistantService.instance
    finish()
    if (resultCode == RESULT_OK && data != null) assistant?.captureGranted(resultCode, data)
    else assistant?.captureCancelled("Screen capture cancelled. Nothing was captured.")
  }
}
