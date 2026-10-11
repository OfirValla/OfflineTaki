# Building and installing the Android APK

Everything here runs on Windows (PowerShell) and equally on macOS/Linux with `./gradlew`
instead of `gradlew`.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22.11 or newer | `node --version` |
| JDK | 17 (Temurin) | `JAVA_HOME` must point at it |
| Android SDK | platform `android-37.0`, build-tools `37.0.0`, NDK `28.2.13676358` | `ANDROID_HOME` must point at the SDK root. Install with `sdkmanager "platforms;android-37.0" "build-tools;37.0.0" "ndk;28.2.13676358"`. The NDK version is pinned in `android/build.gradle` (`ndkVersion`) |
| adb | any recent | only for installing over USB; copying the APK to the phone also works |

No Android Studio is required. No emulator is useful for this project: Nearby Connections
needs real Bluetooth hardware, so testing happens on physical phones.

## One-time setup

```powershell
npm install
```

Release signing is already configured:

- `android/app/offlinetaki-release.keystore` holds the release key.
- `android/keystore.properties` holds its passwords (git-ignored, see
  `android/keystore.properties.example`).

**Back both files up somewhere safe.** Every future release APK must be signed with the same
key, otherwise phones refuse to upgrade the installed app and users must uninstall first.
To create a fresh key on another machine:

```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore android/app/offlinetaki-release.keystore `
  -alias offlinetaki -keyalg RSA -keysize 2048 -validity 10000
```

then write the passwords into `android/keystore.properties`. If that file is missing, Gradle
falls back to the debug keystore: the APK still installs, it is just not upgrade-compatible with
properly signed builds.

## Build commands

| Goal | Command | Output |
|---|---|---|
| Release APK (standalone, what you hand to players) | `npm run android:release` | `android\app\build\outputs\apk\release\app-release.apk` |
| Debug APK (for development with Metro) | `npm run android:debug` | `android\app\build\outputs\apk\debug\app-debug.apk` |

Both scripts are thin wrappers:

```powershell
cd android
.\gradlew assembleRelease
.\gradlew assembleDebug
```

The first build downloads Gradle and dependencies and takes several minutes; later builds take
about a minute.

### What "standalone" means

`assembleRelease` bundles the JavaScript, compiles it to Hermes bytecode and packs it into the
APK. The installed app never contacts Metro, a development server or the internet.

The debug variant is different: it loads JavaScript from Metro on your computer, which is what
you want while developing (`npm start`, then `npm run android`). If you need a debug-signed APK
that also runs without a computer, uncomment `debuggableVariants = []` in
`android/app/build.gradle` and rebuild.

### About the INTERNET permission

The manifest still declares `android.permission.INTERNET`. It exists only so that debug builds
can reach Metro; the app itself makes no network requests. Removing it from release builds is
possible with a manifest overlay (`android/app/src/release/AndroidManifest.xml` using
`tools:node="remove"`) and is planned once the two-phone test confirms Nearby Connections does
not need it inside the app process.

## Installing on phones

Over USB with developer options enabled:

```powershell
adb install -r android\app\build\outputs\apk\release\app-release.apk
```

Without a computer: copy `app-release.apk` to the phone (USB, Quick Share, Bluetooth file
transfer, chat app), open it from the Files app and allow installing from that source when
Android asks. All players must install the same build.

## Permissions the player is asked for

| Android version | Dialogs | Also required |
|---|---|---|
| 13 and newer | "Nearby devices", optional "Notifications" | Bluetooth on |
| 12 / 12L | "Nearby devices", "Location" | Bluetooth on |
| 6 to 11 | "Location" | Bluetooth on **and** the system Location toggle on |

The Home screen shows a banner with a one-tap fix for whichever of these is missing. No location
data is read by the app; the permission exists because Android ties Bluetooth scanning to it on
older versions. Google Play Services must be installed (it is on almost every phone sold outside
China; Huawei phones without it will show a clear message).

## Offline acceptance test (Phase 2)

1. Install `app-release.apk` on two Android phones. Disconnect the computer.
2. Put both phones in airplane mode, then turn Bluetooth back on from the quick settings.
   Leave Wi-Fi off to prove the Bluetooth-only path (turning it on later is fine and may make
   the link faster).
3. Phone A: enter a name, tap **Create Game**. The screen shows "Hosting · Visible to nearby
   phones" and a "Hosting" notification appears.
4. Phone B: enter a name, tap **Join Nearby Game**. Phone A's game appears within a few
   seconds; tap it.
5. Both phones list both players. Type "Hello from A" on one phone and "Hello from B" on the
   other; each message appears on both phones.
6. Optional: a third phone joins; its messages reach everyone (the host relays).
7. Seats and bots: on Phone A set **Players** to 4 (Home screen before creating, or the
   stepper on the lobby screen). Both phones show "Players 2/4" with two open seats. Phone A taps
   **Start with 2 bots** and confirms. Both phones switch to the table with Ofir, B, Bot 1 and
   Bot 2, eight cards each, and a fourth phone can no longer find or join the game.
8. Play a round. Check: the banner says YOUR TURN only on the phone whose turn it is; playable
   cards are raised and bright, the rest muted; bots take their turns after about a second;
   a Change Color asks for a colour; a TAKI lets you chain cards of that colour and shows
   **Close TAKI**; a Plus gives you another card to play; Stop skips the next player. The first
   phone with no cards wins and both phones show the same ranking. The host can tap **New round**.
9. Reactions: tap the smiley at the top-right of the table and pick an emoji. It pops up over your
   hand on your phone and over your seat on the other phones for about three seconds, with a
   soft boop, and shows up in the lobby chat log. Tapping several in a row only sends one per
   0.7 seconds.
10. Reconnect: mid-game, turn Bluetooth off on Phone B for ten seconds, then on again. Phone A shows
   B as "reconnecting…" while the game goes on. On Phone B go back to **Join Nearby Game** and
   tap the game again: B is back at the table with the same cards.
11. Phone B taps **Leave**; Phone A shows "B left". Phone A taps **Stop**; Phone B
    (if still connected) shows the connection-lost banner.

## Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| Join screen never lists the game | Host not on the game screen, Bluetooth off on either side, Location off (Android ≤ 12), phones more than ~10 m apart | Check the Home screen banner on both phones |
| "Connection failed: STATUS_BLUETOOTH_ERROR (8007)" | Bluetooth stack hiccup | Toggle Bluetooth off/on, retry |
| "STATUS_ALREADY_ADVERTISING (8001)" in logs | Advertising restarted quickly | Harmless, handled |
| Host disappears when the screen turns off | Aggressive OEM battery saver killed the app | Exclude Offline TAKI from battery optimisation; keep the app open |
| Everything works at home, not on the plane | Wi-Fi was doing the work at home | Test at home with Wi-Fi off to reproduce the in-flight conditions |

Logs: `adb logcat -s ReactNativeJS NearbyConnections` while the phone is connected.

## Sound effects

The effects are synthesised, not recorded: `scripts/generate-sounds.js` writes small 16-bit WAV
files into `android/app/src/main/res/raw/` (about 280 KB in total), so the app ships licence-free
audio and never downloads anything. The generated files are committed; regenerate after editing
the script with:

```powershell
node scripts/generate-sounds.js
```

Playback uses react-native-sound on the media stream (volume keys and silent mode apply). The
speaker button on the Home screen and the game menu mute everything; the choice is remembered.

| Sound | When |
|---|---|
| card snap | any card lands on the pile |
| zap | Stop, Plus or Change Direction played |
| swish | a card is drawn |
| two-note chime | the turn passes to you |
| rising arpeggio | a TAKI opens |
| bling | a colour is chosen |
| low buzz | the host refused your move |
| fanfare / descending notes | you won / someone else won |
| pop | a player joined the lobby |
| two-tone boop | an emoji reaction arrived |
| burst of snaps | the deal |

## App icon

The launcher icon is generated, not drawn by hand, so it can be tweaked in code:

- `scripts/generate-icon.js` writes the adaptive icon for Android 8 and newer (vector foreground,
  background and a monochrome layer for themed icons) into `res/drawable` and `res/mipmap-anydpi-v26`.
- `scripts/render-icon-pngs.ps1` renders the same design with GDI+ into the legacy PNG mipmaps
  for Android 7, plus `dist/icon-512.png` as a store-sized preview.

Both scripts share the same numbers; change the design in one and mirror it in the other, then run:

```powershell
node scripts/generate-icon.js
pwsh scripts/render-icon-pngs.ps1
```

## Screenshots for the README

With one unlocked phone over USB, `pwsh scripts/capture-screenshots.ps1` drives the app through
home, lobby, a bot game and the reaction tray and saves half-size PNGs into `docs/screenshots`.
It finds buttons by their on-screen text, so it needs a player name already entered.

## Developer checks

```powershell
npm run typecheck   # TypeScript
npm run lint        # ESLint, including the layer-boundary rules
npm test            # Jest: protocol, codecs, in-memory transport, session logic
```
