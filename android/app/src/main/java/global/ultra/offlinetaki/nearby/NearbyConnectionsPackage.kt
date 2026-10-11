package global.ultra.offlinetaki.nearby

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Registers the Nearby Connections TurboModule. Added manually in MainApplication. */
class NearbyConnectionsPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == NearbyConnectionsModule.NAME) NearbyConnectionsModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
        NearbyConnectionsModule.NAME to
            ReactModuleInfo(
                NearbyConnectionsModule.NAME,
                NearbyConnectionsModule::class.java.name,
                /* canOverrideExistingModule = */ false,
                /* needsEagerInit = */ false,
                /* isCxxModule = */ false,
                /* isTurboModule = */ true,
            ))
  }
}
