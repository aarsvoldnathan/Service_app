# Service Ceo

Service and maintenance log for households, rental hubs and dealerships.
Tracks maintenance done and due, based on calendar dates and equipment hours.

Built with Expo (React Native + TypeScript). One codebase runs on iOS and Android.

## Current status: MVP of Screen 1 (Dashboard)

- Three tiles: Overdue, Due soon, Hours stale.
- **Maintenance due**: every service that is overdue or coming due. Each service can repeat by engine hours, calendar days, or both (whichever comes first).
- **Hours to update**: equipment whose hours have not been updated in 7+ days, with a field to enter the new reading.
- **Maintenance done**: services logged in the last 30 days.
- Data is saved on the device. Demo equipment loads on first launch.

## Project structure

```
Service_app/
  package.json         Dependencies and scripts
  app.json             App name, bundle IDs
  tsconfig.json        TypeScript settings
  app/
    _layout.tsx        Root layout, theme, data provider
    index.tsx          Screen 1: Dashboard
  src/
    theme.ts           Colors, spacing, touch-target size
    types.ts           Asset, ServiceTask, ServiceLog
    maintenance.ts     Due-date / due-hours logic
    seedData.ts        Demo equipment, schedules, history
    store.tsx          App data + saving to device storage
    components/
      Tile.tsx
      DueRow.tsx
      HoursRow.tsx
```

## Run it on your phone

### One-time setup

1. Install **Node.js LTS** from https://nodejs.org.
2. Install **Visual Studio Code** from https://code.visualstudio.com.
3. Install **GitHub Desktop** from https://desktop.github.com and sign in.
4. On your phone, install **Expo Go** (App Store or Google Play).
5. Keep your phone and computer on the same Wi-Fi network.

### Get the code and start it

1. In GitHub Desktop: File > Clone repository > `aarsvoldnathan/Service_app` > Clone.
2. In VS Code: File > Open Folder > select the cloned `Service_app` folder.
3. Open a terminal: Terminal > New Terminal.
4. Run this once. It installs everything and matches versions to the current Expo Go app:
   ```
   npm run setup
   ```
5. Start the app:
   ```
   npm start
   ```
6. Scan the QR code. iPhone: use the Camera app. Android: use the "Scan QR code" button in Expo Go.

Edit any file and save. The app on your phone updates instantly.

After `npm run setup`, commit the updated `package.json` and new `package-lock.json` in GitHub Desktop so everyone uses the same versions.

## Publish to the App Store and Google Play

1. Create a free Expo account: https://expo.dev/signup
2. Install the build tool and sign in:
   ```
   npm install -g eas-cli
   eas login
   eas build:configure
   ```
3. Build the apps (they build in the cloud; no Mac needed for iOS):
   ```
   eas build --platform android
   eas build --platform ios
   ```
   - iOS requires an Apple Developer Program membership ($99/year): https://developer.apple.com/programs
   - Android requires a Google Play developer account ($25 one time): https://play.google.com/console
4. Submit to the stores:
   ```
   eas submit --platform android
   eas submit --platform ios
   ```
5. Before the first public release: add an app icon and splash image (`assets/` folder, referenced in `app.json`) and complete each store's listing and privacy form.

To test with employees before release, use TestFlight (iOS) and an Internal testing track (Android).

## TestFlight builds from GitHub (no Mac needed)

`.github/workflows/ios-testflight.yml` builds the iPhone app on GitHub's Mac machines on every push to `main`.

- To send a build to TestFlight, put `[upload]` in the first line of the commit message, or run the workflow from the Actions tab with "Upload to TestFlight" ticked.
- It needs four repository secrets (Settings > Secrets and variables > Actions): `APPLE_TEAM_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY` (full text of the .p8 key file).
- The upload registers the bundle ID `com.aarsvold.serviceceo` automatically. The app record must exist in App Store Connect (My Apps > + > New App, same bundle ID) before the first upload.
- The app icon is `assets/icon.png`.
- After an upload, the build shows up in App Store Connect > TestFlight once Apple finishes processing it, usually within 15 minutes.

## Roadmap

1. Screen 2: equipment detail with service specs (lug nut torque, tire pressure, oil type and capacity, filter part numbers) and the service logging form.
2. Shared fleets and approved users: online backend (Supabase) with login and per-fleet permissions.
3. Push notifications when maintenance comes due (expo-notifications).
