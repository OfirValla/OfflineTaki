package global.ultra.offlinetaki.nearby

import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.WindowManager
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsClient
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import global.ultra.offlinetaki.specs.NativeNearbyConnectionsSpec
import java.util.concurrent.ConcurrentHashMap

/**
 * Thin bridge over Google Nearby Connections.
 *
 * Responsibilities: advertise, discover, connect, move UTF-8 strings, report radio state and
 * keep the host process alive. It auto-accepts every connection at the link level; approval,
 * join codes and identity live in the TypeScript protocol layer so that every transport
 * behaves the same way.
 */
@ReactModule(name = NearbyConnectionsModule.NAME)
class NearbyConnectionsModule(reactContext: ReactApplicationContext) :
    NativeNearbyConnectionsSpec(reactContext), ActivityEventListener {

  companion object {
    const val NAME = "NativeNearbyConnections"
    const val EVENT_NAME = "NearbyConnectionsEvent"
    private const val MAX_PEERS = 7
    private const val REQUEST_ENABLE_BLUETOOTH = 0x7A41
    /** Android 12L and below: Bluetooth/Wi-Fi scanning needs system Location to be on. */
    private const val LAST_API_REQUIRING_LOCATION = Build.VERSION_CODES.S_V2
  }

  private val connections: ConnectionsClient by lazy {
    Nearby.getConnectionsClient(reactApplicationContext)
  }
  private val pendingConnections = ConcurrentHashMap<String, Promise>()
  private val locallyDisconnected = ConcurrentHashMap.newKeySet<String>()
  private var enableBluetoothPromise: Promise? = null
  private val radioMonitor = RadioStateMonitor(reactApplicationContext) { emitRadioStatus() }

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = NAME

  override fun initialize() {
    super.initialize()
    radioMonitor.start()
  }

  override fun invalidate() {
    radioMonitor.stop()
    runCatching {
      connections.stopAllEndpoints()
      connections.stopAdvertising()
      connections.stopDiscovery()
    }
    reactApplicationContext.removeActivityEventListener(this)
    super.invalidate()
  }

  // ---------------------------------------------------------------------------------------
  // Environment
  // ---------------------------------------------------------------------------------------

  override fun getCapabilities(promise: Promise) {
    val ctx = reactApplicationContext
    val playServices =
        GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(ctx) ==
            ConnectionResult.SUCCESS
    val map = Arguments.createMap()
    map.putBoolean("playServicesAvailable", playServices)
    map.putBoolean("bluetoothSupported", bluetoothAdapter() != null)
    map.putInt("maxPeers", MAX_PEERS)
    map.putInt("maxMessageBytes", ConnectionsClient.MAX_BYTES_DATA_SIZE)
    promise.resolve(map)
  }

  override fun getRadioStatus(promise: Promise) {
    promise.resolve(radioStatusMap())
  }

  override fun requestEnableBluetooth(promise: Promise) {
    val adapter = bluetoothAdapter()
    if (adapter == null) {
      promise.reject("E_UNSUPPORTED", "This device has no Bluetooth adapter")
      return
    }
    if (adapter.isEnabled) {
      promise.resolve(true)
      return
    }
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "No foreground activity to show the Bluetooth dialog")
      return
    }
    enableBluetoothPromise?.resolve(false)
    enableBluetoothPromise = promise
    try {
      activity.startActivityForResult(
          Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), REQUEST_ENABLE_BLUETOOTH)
    } catch (e: SecurityException) {
      enableBluetoothPromise = null
      promise.reject("E_PERMISSION", "BLUETOOTH_CONNECT permission is required", e)
    }
  }

  override fun openLocationSettings() {
    launchSettings(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
  }

  override fun openAppSettings() {
    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
    intent.data = Uri.fromParts("package", reactApplicationContext.packageName, null)
    launchSettings(intent)
  }

  // ---------------------------------------------------------------------------------------
  // Host role
  // ---------------------------------------------------------------------------------------

  override fun startAdvertising(endpointName: String, serviceId: String, promise: Promise) {
    val options =
        AdvertisingOptions.Builder()
            .setStrategy(Strategy.P2P_STAR)
            // Never switch the phone's Wi-Fi network behind the user's back.
            .setDisruptiveUpgrade(false)
            .build()
    connections
        .startAdvertising(endpointName, serviceId, lifecycleCallback, options)
        .addOnSuccessListener { promise.resolve(null) }
        .addOnFailureListener { error ->
          if (statusCodeOf(error) == ConnectionsStatusCodes.STATUS_ALREADY_ADVERTISING) {
            promise.resolve(null)
          } else {
            promise.reject("E_ADVERTISE_FAILED", describe(error), error)
          }
        }
  }

  override fun stopAdvertising(promise: Promise) {
    connections.stopAdvertising()
    promise.resolve(null)
  }

  // ---------------------------------------------------------------------------------------
  // Client role
  // ---------------------------------------------------------------------------------------

  override fun startDiscovery(serviceId: String, promise: Promise) {
    val options = DiscoveryOptions.Builder().setStrategy(Strategy.P2P_STAR).build()
    connections
        .startDiscovery(serviceId, discoveryCallback, options)
        .addOnSuccessListener { promise.resolve(null) }
        .addOnFailureListener { error ->
          if (statusCodeOf(error) == ConnectionsStatusCodes.STATUS_ALREADY_DISCOVERING) {
            promise.resolve(null)
          } else {
            promise.reject("E_DISCOVERY_FAILED", describe(error), error)
          }
        }
  }

  override fun stopDiscovery(promise: Promise) {
    connections.stopDiscovery()
    promise.resolve(null)
  }

  override fun requestConnection(endpointId: String, localEndpointName: String, promise: Promise) {
    pendingConnections.remove(endpointId)?.reject("E_SUPERSEDED", "A newer connection request replaced this one")
    pendingConnections[endpointId] = promise
    locallyDisconnected.remove(endpointId)
    connections
        .requestConnection(localEndpointName, endpointId, lifecycleCallback)
        .addOnFailureListener { error ->
          val code = statusCodeOf(error)
          val pending = pendingConnections.remove(endpointId) ?: return@addOnFailureListener
          if (code == ConnectionsStatusCodes.STATUS_ALREADY_CONNECTED_TO_ENDPOINT) {
            pending.resolve(null)
          } else {
            pending.reject("E_CONNECT_FAILED", describe(error), error)
          }
        }
  }

  // ---------------------------------------------------------------------------------------
  // Both roles
  // ---------------------------------------------------------------------------------------

  override fun disconnectFromEndpoint(endpointId: String) {
    locallyDisconnected.add(endpointId)
    pendingConnections.remove(endpointId)?.reject("E_CANCELLED", "Connection cancelled")
    connections.disconnectFromEndpoint(endpointId)
  }

  override fun stopAllEndpoints() {
    pendingConnections.values.forEach { it.reject("E_CANCELLED", "All endpoints stopped") }
    pendingConnections.clear()
    connections.stopAllEndpoints()
  }

  override fun sendPayload(endpointId: String, payload: String, promise: Promise) {
    val bytes = payload.toByteArray(Charsets.UTF_8)
    if (bytes.size > ConnectionsClient.MAX_BYTES_DATA_SIZE) {
      promise.reject(
          "E_PAYLOAD_TOO_LARGE",
          "Payload is ${bytes.size} bytes; limit is ${ConnectionsClient.MAX_BYTES_DATA_SIZE}")
      return
    }
    connections
        .sendPayload(endpointId, Payload.fromBytes(bytes))
        .addOnSuccessListener { promise.resolve(null) }
        .addOnFailureListener { error -> promise.reject("E_SEND_FAILED", describe(error), error) }
  }

  // ---------------------------------------------------------------------------------------
  // Device housekeeping
  // ---------------------------------------------------------------------------------------

  override fun startHostService(title: String, text: String) {
    val ctx = reactApplicationContext
    val intent =
        Intent(ctx, HostForegroundService::class.java)
            .putExtra(HostForegroundService.EXTRA_TITLE, title)
            .putExtra(HostForegroundService.EXTRA_TEXT, text)
    ContextCompat.startForegroundService(ctx, intent)
  }

  override fun stopHostService() {
    val ctx = reactApplicationContext
    ctx.stopService(Intent(ctx, HostForegroundService::class.java))
  }

  override fun setKeepScreenOn(enabled: Boolean) {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      if (enabled) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      } else {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      }
    }
  }

  override fun addListener(eventName: String) {
    // Required by NativeEventEmitter; events are always emitted.
  }

  override fun removeListeners(count: Double) {
    // Required by NativeEventEmitter; events are always emitted.
  }

  // ---------------------------------------------------------------------------------------
  // Activity results
  // ---------------------------------------------------------------------------------------

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode == REQUEST_ENABLE_BLUETOOTH) {
      enableBluetoothPromise?.resolve(resultCode == Activity.RESULT_OK)
      enableBluetoothPromise = null
      emitRadioStatus()
    }
  }

  override fun onNewIntent(intent: Intent) {
    // Not used.
  }

  // ---------------------------------------------------------------------------------------
  // Nearby callbacks
  // ---------------------------------------------------------------------------------------

  private val lifecycleCallback =
      object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
          // Link-level acceptance is automatic; the protocol layer decides who may join.
          connections.acceptConnection(endpointId, payloadCallback)
          emit("connectionInitiated") {
            putString("peerId", endpointId)
            putString("peerName", info.endpointName)
            putString("verificationCode", info.authenticationDigits)
            putBoolean("incoming", info.isIncomingConnection)
          }
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
          val pending = pendingConnections.remove(endpointId)
          if (result.status.isSuccess) {
            emit("peerConnected") { putString("peerId", endpointId) }
            pending?.resolve(null)
          } else {
            val code = result.status.statusCode
            val message = ConnectionsStatusCodes.getStatusCodeString(code)
            emit("connectionFailed") {
              putString("peerId", endpointId)
              putInt("statusCode", code)
              putString("statusMessage", message)
            }
            pending?.reject("E_CONNECT_REJECTED", "Connection failed: $message ($code)")
          }
        }

        override fun onDisconnected(endpointId: String) {
          val reason = if (locallyDisconnected.remove(endpointId)) "local" else "remote"
          emit("peerDisconnected") {
            putString("peerId", endpointId)
            putString("reason", reason)
          }
        }
      }

  private val payloadCallback =
      object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
          if (payload.type != Payload.Type.BYTES) return
          val bytes = payload.asBytes() ?: return
          emit("message") {
            putString("peerId", endpointId)
            putString("payload", String(bytes, Charsets.UTF_8))
          }
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
          // BYTES payloads complete atomically; nothing to track.
        }
      }

  private val discoveryCallback =
      object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
          emit("endpointFound") {
            putString("peerId", endpointId)
            putString("endpointName", info.endpointName)
            putString("serviceId", info.serviceId)
          }
        }

        override fun onEndpointLost(endpointId: String) {
          emit("endpointLost") { putString("peerId", endpointId) }
        }
      }

  // ---------------------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------------------

  private fun emit(type: String, fill: WritableMap.() -> Unit = {}) {
    val map = Arguments.createMap()
    map.putString("type", type)
    map.fill()
    reactApplicationContext.emitDeviceEvent(EVENT_NAME, map)
  }

  private fun emitRadioStatus() {
    emit("radioStatus") { merge(radioStatusMap()) }
  }

  private fun radioStatusMap(): WritableMap {
    val ctx = reactApplicationContext
    val locationManager = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val map = Arguments.createMap()
    map.putBoolean("bluetoothEnabled", bluetoothAdapter()?.isEnabled == true)
    map.putBoolean("locationEnabled", LocationManagerCompat.isLocationEnabled(locationManager))
    map.putBoolean("locationRequired", Build.VERSION.SDK_INT <= LAST_API_REQUIRING_LOCATION)
    map.putInt("apiLevel", Build.VERSION.SDK_INT)
    return map
  }

  private fun bluetoothAdapter(): BluetoothAdapter? {
    val manager =
        reactApplicationContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    return manager?.adapter
  }

  private fun launchSettings(intent: Intent) {
    val activity = reactApplicationContext.currentActivity
    if (activity != null) {
      activity.startActivity(intent)
    } else {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
    }
  }

  private fun statusCodeOf(error: Exception): Int =
      (error as? ApiException)?.statusCode ?: -1

  private fun describe(error: Exception): String {
    val api = error as? ApiException ?: return error.message ?: error.javaClass.simpleName
    val code = api.statusCode
    return "${ConnectionsStatusCodes.getStatusCodeString(code)} ($code)"
  }
}
