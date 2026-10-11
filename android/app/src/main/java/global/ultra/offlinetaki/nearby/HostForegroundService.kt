package global.ultra.offlinetaki.nearby

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import global.ultra.offlinetaki.R

/**
 * Keeps the hosting process alive while the screen is off or the app is briefly in the
 * background. Without a foreground service Android may freeze the app and the Nearby
 * callbacks stop arriving, which ends the game for everyone.
 */
class HostForegroundService : Service() {

  companion object {
    const val EXTRA_TITLE = "title"
    const val EXTRA_TEXT = "text"
    private const val CHANNEL_ID = "offline_taki_host"
    private const val NOTIFICATION_ID = 0x7A4B
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Hosting a game"
    val text = intent?.getStringExtra(EXTRA_TEXT) ?: "Nearby players can join"
    ensureChannel()

    val launchIntent =
        packageManager.getLaunchIntentForPackage(packageName)?.apply {
          addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
    val contentIntent =
        launchIntent?.let {
          PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }

    val notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(contentIntent)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

    val type =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
        } else {
          0
        }
    ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
    // If the system kills us, do not come back on our own: the app decides when to host.
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel =
        NotificationChannel(CHANNEL_ID, "Game hosting", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Shown while this phone hosts an Offline TAKI game"
          setShowBadge(false)
        }
    manager.createNotificationChannel(channel)
  }
}
