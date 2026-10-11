/** Shape of the events the Kotlin module emits under `NEARBY_EVENT_NAME`. Keep in sync with NearbyConnectionsModule.kt. */

export const NEARBY_EVENT_NAME = 'NearbyConnectionsEvent';

export type NearbyRadioStatusEvent = {
  type: 'radioStatus';
  bluetoothEnabled: boolean;
  locationEnabled: boolean;
  locationRequired: boolean;
  apiLevel: number;
};

export type NearbyNativeEvent =
  | NearbyRadioStatusEvent
  | {
      type: 'endpointFound';
      peerId: string;
      endpointName: string;
      serviceId: string;
    }
  | { type: 'endpointLost'; peerId: string }
  | {
      type: 'connectionInitiated';
      peerId: string;
      peerName: string;
      verificationCode: string;
      incoming: boolean;
    }
  | { type: 'peerConnected'; peerId: string }
  | {
      type: 'connectionFailed';
      peerId: string;
      statusCode: number;
      statusMessage: string;
    }
  | { type: 'peerDisconnected'; peerId: string; reason: 'local' | 'remote' }
  | { type: 'message'; peerId: string; payload: string };
