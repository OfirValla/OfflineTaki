# Offline TAKI

A TAKI-style card game for 2–8 players on nearby phones, with no internet, no server and no account.
One phone hosts, the others join over a local radio link. Android first; iOS later behind the same
transport abstraction.

- Architecture and decisions: [docs/PHASE1-ARCHITECTURE.md](docs/PHASE1-ARCHITECTURE.md)
- Building, signing, installing and testing the APK: [docs/BUILD.md](docs/BUILD.md)

## Status

Playable (Phases 4 and 5). The host phone runs the rules engine, phones send card plays over Nearby
Connections and receive only what they may see, bots fill empty seats and take their turns, and the
game screen shows the table, the hand with playable cards highlighted, TAKI mode, colour choice and
the final ranking, quick emoji reactions, all drawn as a blue-felt table with fanned cards and
synthesised sound effects. Dropped phones can reclaim their
seat. Phase 6 hardens reconnect and timeouts.

## Quick start

```powershell
npm install
npm run android:release   # -> android\app\build\outputs\apk\release\app-release.apk
```

Install the APK on two Android phones, enable airplane mode, turn Bluetooth back on, and follow the
acceptance test in `docs/BUILD.md`.

## Layout

```
android/                       standard Gradle project + Kotlin Nearby Connections module
src/
  native/                      TurboModule spec and native event types
  networking/transport/        NearbyTransport interface, Nearby implementation, in-memory test transport
  networking/protocol/         message enum, zod schemas, codec
  networking/session/          shared session state + core
  networking/host/             GameHost: engine owner, event log, bots
  networking/client/           GameClient: view reducer, resync
  game/                        pure rules engine: cards, rules/handlers, engine, state, projection
  platform/                    permissions, radio state, foreground service, keep-awake, sound effects
scripts/                       generate-sounds.js (WAV effects), generate-icon.js + render-icon-pngs.ps1 (launcher icon)
  storage/                     player profile persistence
  app/ screens/ components/ hooks/   React Native UI
docs/
```

## Phases

1. Architecture — done
2. Android ↔ Android networking POC, standalone APK — done, verified on two phones
3. Game engine + unit tests — done
4. Host/client synchronization — done (GameHost / GameClient, bots, resync, reconnect tokens)
5. Lobby and game UI — done
6. Reliability: reconnect, snapshots, disconnect handling
7. iOS transport (BLE GATT / Multipeer)
