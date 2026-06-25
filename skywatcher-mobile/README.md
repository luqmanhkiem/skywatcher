# SkyWatcher Mobile (Flutter)

A lightweight iOS/Android ground-ops client for SkyWatcher. It reuses the existing
Flask REST API — login (JWT), live anomaly **Alerts**, and resolve.

This folder ships only the Dart source (`lib/`) and `pubspec.yaml`. You generate the
native iOS/Android project folders once with `flutter create .` (below).

## Screens
- **Login** — calls `POST /api/auth/login`, stores the JWT in `shared_preferences`.
- **Alerts** — `GET /api/alerts` every 5s, pull-to-refresh, `PATCH /api/alerts/:id/resolve`.
  Fires a **local push notification** (buzz + badge) whenever a *new* anomaly of
  any type appears while the app is running — no FCM / Apple push server needed.
- **Bags** — searchable list of every bag (`GET /api/bags`, tag / passenger /
  flight / status). Tap a bag to open its **detail** — the FSM **status badge**,
  a **Register scan** control (pick a checkpoint → `POST /api/bags/:tag/scan`),
  **operator actions** (hold/release/reroute/claim/report_lost/found →
  `POST /api/bags/:tag/action`; only valid-from-state actions show), the
  **status-transition trail** (`GET /api/bags/:tag/status-history`), and the
  visual check_in → arrival journey stepper (`GET /api/bags/:tag/history`).
- **Scan** (QR) — the flagship "real input" path. Tap the scan button on the
  Bags header to open the camera (`mobile_scanner`), point at a printed bag-tag
  QR, and it resolves to the bag and opens its detail to register a checkpoint.
  A **manual tag-entry** fallback is always available (and required on the iOS
  Simulator, which has no camera).

A bottom navigation bar switches between **Alerts** and **Bags**.

## 0. Install Flutter (one-time)
```bash
brew install --cask flutter        # or download from https://flutter.dev
flutter doctor                     # follow prompts to finish Xcode / Android Studio setup
```
- **iOS:** needs Xcode (you're on a Mac ✅). Easiest demo target is the iOS Simulator.
- **Android:** needs Android Studio + an emulator (AVD).

## 1. Generate native project folders
From this directory:
```bash
cd "skywatcher-mobile"
flutter create .          # adds android/ ios/ etc. WITHOUT touching lib/ or pubspec.yaml
flutter pub get
```

### iOS: CocoaPods (one-time)
The iOS build needs CocoaPods. If `pod` isn't installed:
```bash
brew install cocoapods
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer   # point at full Xcode, not CLT
cd ios && LANG=en_US.UTF-8 pod install && cd ..
```
The iOS deployment target is **13.0** (`ios/Podfile`) — required by the
notifications plugin.

## 2. Point the app at your backend
Edit `lib/api.dart` → `kBaseUrl`:
- **iOS Simulator / real iPhone on same Wi-Fi:** `http://192.168.1.19:5001/api`
  (re-check your Mac's IP with `ipconfig getifaddr en0`)
- **Android emulator:** `http://10.0.2.2:5001/api`

## 3. Allow plain HTTP (the backend is http://, not https://)
Modern iOS/Android block cleartext HTTP by default — enable it for the demo:

**Android** — in `android/app/src/main/AndroidManifest.xml`, add to the `<application>` tag:
```xml
<application
    android:usesCleartextTraffic="true"
    ... >
```

**iOS** — in `ios/Runner/Info.plist`, add inside the top-level `<dict>`:
```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <true/>
</dict>
<!-- Camera permission for the QR scanner (mobile_scanner) -->
<key>NSCameraUsageDescription</key>
<string>SkyWatcher uses the camera to scan QR bag tags and register checkpoint scans.</string>
```
(Both keys are already present in the committed `ios/Runner/Info.plist`; re-add
them if you regenerate the native folder with `flutter create .`.)

## 4. Run
Make sure the backend is up (`./start.sh` in the repo root), then:
```bash
flutter run            # pick a device when prompted
```
Log in with a demo account (`admin`/`admin123` or `staff1`/`staff123`).

## QR scanner (`mobile_scanner`) — build notes
The scanner uses `mobile_scanner`, which on iOS depends on Google ML Kit.

- **Build/run on a real iPhone.** ML Kit ships no arm64 *simulator* slice, so on
  an Apple-Silicon Mac the **iOS Simulator cannot build** the app. Use a real
  device (`flutter run -d <iphone>` / `flutter build ios`). On the simulator,
  use the Alerts/Bags screens; the camera isn't available there anyway.
- **openrsync fix (macOS 15.4+/Tahoe).** Newer macOS ships `openrsync`, which
  breaks Xcode's "Embed Pods Frameworks" step with
  `rsync: Remote --files-from with a local transfer is not valid`. Install a
  compatible rsync and make sure Homebrew's bin is ahead of `/usr/bin` on PATH:
  ```bash
  brew install rsync
  rsync --version            # should report 3.x, from /opt/homebrew/bin
  ```
  Then `flutter build ios --no-codesign --debug` completes
  (`✓ Built build/ios/iphoneos/Runner.app`).
- The app grants camera access via `NSCameraUsageDescription` (step 3). If the
  camera can't start, the Scan screen falls back to manual tag entry.

## Notes / next steps
- This is a scoped starting point (login + Alerts). The API client in `lib/api.dart`
  is the place to add `getBags()`, `getFeedback()`, etc. — same pattern.
- For a packaged demo you'd later swap the backend onto a hosted URL (https) and
  drop the cleartext exceptions above.
