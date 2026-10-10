package expo.modules.floatingassistant

import org.json.JSONObject

/** Labels come from the one persisted React Native preference, even while disabled. */
object FloatingStrings {
  private var labels = JSONObject()
  fun update(value: JSONObject) { labels = value }
  fun t(key: String): String = labels.optString(key, key)
}
