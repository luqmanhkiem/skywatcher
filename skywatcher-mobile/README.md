# SkyWatcher Mobile (Flutter)

A lightweight iOS/Android ground-ops client for SkyWatcher. It reuses the existing
Flask REST API — login (JWT), live anomaly **Alerts**, and resolve.

This folder ships only the Dart source (`lib/`) and `pubspec.yaml`. You generate the
native iOS/Android project folders once with `flutter create .` (below).

## Screens
- **Login** — calls `POST /api/auth/login`, stores the JWT in `shared_preferences`.
- **Alerts** — `GET /api/alerts` every 5s, pull-to-refresh, `PATCH /api/alerts/:id/resolve`.

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
```

## 4. Run
Make sure the backend is up (`./start.sh` in the repo root), then:
```bash
flutter run            # pick a device when prompted
```
Log in with a demo account (`admin`/`admin123` or `staff1`/`staff123`).

## Notes / next steps
- This is a scoped starting point (login + Alerts). The API client in `lib/api.dart`
  is the place to add `getBags()`, `getFeedback()`, etc. — same pattern.
- For a packaged demo you'd later swap the backend onto a hosted URL (https) and
  drop the cleartext exceptions above.
