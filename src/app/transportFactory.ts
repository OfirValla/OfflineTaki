import { Platform } from 'react-native';
import { NearbyConnectionsTransport } from '../networking/transport/NearbyConnectionsTransport';
import type { NearbyTransport } from '../networking/transport/types';

/**
 * The one place that knows which radio implementation this build uses. Phase 7 adds the BLE
 * GATT transport (both platforms) and the iOS Multipeer transport behind the same interface.
 */
export function createTransport(): NearbyTransport {
  if (Platform.OS === 'android') {
    return new NearbyConnectionsTransport();
  }
  throw new Error(`No nearby transport is implemented for ${Platform.OS} yet`);
}
