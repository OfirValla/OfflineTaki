package global.ultra.offlinetaki.nearby

import android.bluetooth.BluetoothAdapter
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.LocationManager
import androidx.core.content.ContextCompat

/** Fires [onChange] whenever Bluetooth or system Location is toggled. */
class RadioStateMonitor(private val context: Context, private val onChange: () -> Unit) {

  private var registered = false

  private val receiver =
      object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
          onChange()
        }
      }

  fun start() {
    if (registered) return
    val filter =
        IntentFilter().apply {
          addAction(BluetoothAdapter.ACTION_STATE_CHANGED)
          addAction(LocationManager.MODE_CHANGED_ACTION)
        }
    // System broadcasts are delivered to non-exported receivers as well.
    ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
    registered = true
  }

  fun stop() {
    if (!registered) return
    runCatching { context.unregisterReceiver(receiver) }
    registered = false
  }
}
