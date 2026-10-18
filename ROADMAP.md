# Service Ceo: Setup Roadmap (Windows PC + Android)

Follow the phases in order. Each phase ends with a checkpoint. Do not skip ahead:
later phases depend on accounts created earlier.

| Phase | What you get | Time | Cost |
|---|---|---|---|
| 1. Computer setup | App running on your Android phone | 30 min | Free |
| 2. Supabase | Online database + logins for shared fleets | 20 min | Free tier |
| 3. Expo account (EAS) | Installable Android app file built in the cloud | 20 min | Free tier |
| 4. Google Play Console | Developer account, verified | 1 hr + 1–3 days review | $25 one time |
| 5. Testing on Google Play | 12 testers for 14 days (personal accounts only) | 14+ days | Free |
| 6. Production release | App public on Google Play | ~7 days review | Free |

Start Phase 4 early. Google's identity verification can take several days, so
you can run it in the background while working on Phases 2 and 3.

---

## Phase 1: Computer setup (Windows)

1. Install **Node.js LTS**: https://nodejs.org (click the LTS button, run the installer, accept the defaults).
2. Install **GitHub Desktop**: https://desktop.github.com and sign in as `aarsvoldnathan`.
3. Install **Visual Studio Code**: https://code.visualstudio.com
4. On your Android phone, install **Expo Go** from Google Play: https://play.google.com/store/apps/details?id=host.exp.exponent
5. In GitHub Desktop: **File > Clone repository > aarsvoldnathan/Service_app > Clone**.
   Note the folder it saves to (default: `Documents\GitHub\Service_app`).
6. In VS Code: **File > Open Folder** and pick that folder. Then **Terminal > New Terminal**.
7. Run:
   ```
   npm run setup
   npm start
   ```
   If Windows says "running scripts is disabled", run this once in the same terminal and try again:
   ```
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```
8. Open Expo Go on your phone and tap **Scan QR code**. Phone and PC must be on the same Wi-Fi.
9. In GitHub Desktop, commit the changed `package.json` and new `package-lock.json` with the message "Lock dependency versions", then click **Push origin**.

**Checkpoint:** the Service Ceo dashboard opens on your phone.

---

## Phase 2: Supabase (online database and logins)

Supabase stores fleets, equipment and service logs online, so every approved user sees the same data.

1. Create an account: https://supabase.com/dashboard/sign-up (choosing **Continue with GitHub** is easiest).
2. Click **New project**.
   - Organization: create one named "Service Ceo".
   - Project name: `service-ceo`
   - Database password: click **Generate a password** and save it in a password manager. You will rarely need it, but it cannot be shown again.
   - Region: **Central US** (or the region closest to your users).
   - Plan: **Free**.
3. Wait about 2 minutes for the project to finish setting up.
4. Click the **Connect** button at the top of the project. Copy two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **Publishable key** (starts with `sb_publishable_`; older projects call it the `anon` key)
5. In VS Code, create a file named `.env` in the project root (same level as `package.json`) containing:
   ```
   EXPO_PUBLIC_SUPABASE_URL=paste-project-url-here
   EXPO_PUBLIC_SUPABASE_KEY=paste-publishable-key-here
   ```
   `.env` is already in `.gitignore`, so it will not be uploaded to GitHub.
6. **Never** put the `secret` / `service_role` key in the app or in GitHub. Only the publishable key goes in the app.
7. Invite Tweltz1: **Organization settings > Team > Invite**, role **Developer**.
8. Send Tweltz1 the two values from step 4 privately (not in GitHub) so they can make their own `.env`.

**Checkpoint:** tell Claude "Supabase is ready". Claude will then add:
the database tables (fleets, members, equipment, schedules, service logs, parts),
security rules so users only see fleets they are approved for, the login screen,
and the switch from on-phone storage to Supabase.

Reference: https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native

---

## Phase 3: Expo account and cloud builds (EAS)

EAS builds the real Android app in the cloud. No Android Studio needed.

1. Create an account: https://expo.dev/signup
2. Create an organization named "service-ceo" and invite Tweltz1:
   https://expo.dev/accounts/[your-account]/settings/members
3. In the VS Code terminal:
   ```
   npm install -g eas-cli
   eas login
   eas init
   eas build:configure
   ```
   Choose **Android** (or All) when asked. Commit and push the new `eas.json` and the updated `app.json`.
4. Build a test app you can install directly on your phone (no Play Store needed):
   ```
   eas build --platform android --profile preview
   ```
   If it asks to generate a new Android keystore, answer **Yes**. Expo stores it safely; do not lose access to this Expo account.
5. When the build finishes (10–20 min), open the link on your Android phone and install the `.apk`.
   Android will ask to allow installs from your browser; allow it.

**Checkpoint:** Service Ceo is installed on your phone as its own app (not inside Expo Go).

Reference: https://docs.expo.dev/build/setup/

---

## Phase 4: Google Play Console account

### Decide first: Personal or Organization account

| | Personal | Organization |
|---|---|---|
| Who | Individual | A registered business (LLC, dealership, etc.) |
| Extra requirement | 12 testers for 14 days before going public | Free **D-U-N-S number** for the business |
| Shown on store as | Your legal name | Business name |

If you have a registered business, an **Organization** account avoids the 12-tester rule and looks
more credible to dealerships and rental companies. Get a free D-U-N-S number first (can take up to 30 days):
https://www.dnb.com/duns/get-a-duns.html

### Sign up

1. Go to https://play.google.com/console/signup and sign in with the Google account that will own the app.
   Use an account you will keep long term; ownership is hard to move later.
2. Pick **Personal** or **Organization** (see above).
3. Pay the **$25** one-time registration fee.
4. Complete identity verification with a government ID. Your legal name and address must match the ID exactly.
5. If Play Console asks you to verify a mobile device, install the **Play Console** app on your Android phone
   and confirm from there: https://play.google.com/store/apps/details?id=com.google.android.apps.playconsole
6. Wait for verification (usually 1–3 days, sometimes longer).
7. Invite Tweltz1: **Users and permissions > Invite new users**, enter their Google email, grant **Release** permissions for the app.

**Checkpoint:** Play Console shows your Dashboard with no verification warnings.

Reference: https://support.google.com/googleplay/android-developer/answer/6112435

---

## Phase 5: Create the app and test on Google Play

### 5a. Create the app listing
1. Play Console > **Create app**. Name: Service Ceo. Type: App. Free.
2. Complete the **Set up your app** checklist on the Dashboard. You will need:
   - A **privacy policy URL** (required because the app has logins). Claude can write this and host it as a page.
   - **Data safety** form (you collect email addresses and the equipment data users enter).
   - App category: **Productivity** or **Business**.
   - Icon (512×512 PNG), feature graphic (1024×500), at least 2 phone screenshots. Claude can produce these.

### 5b. First upload (must be done by hand once)
1. Build the store version:
   ```
   eas build --platform android --profile production
   ```
2. Download the `.aab` file from the build page.
3. Play Console > **Test and release > Testing > Internal testing > Create new release**, upload the `.aab`, save, and roll out.
4. Add yourself and Tweltz1 as internal testers and install from the opt-in link.

### 5c. Let EAS upload future builds automatically
1. Create a Google service account key by following: https://github.com/expo/fyi/blob/main/creating-google-service-account.md
2. Upload the JSON key to Expo: https://expo.dev > your project > **Credentials > Android > Service Credentials**.
   Do not commit the JSON file to GitHub.
3. From then on: `eas build --platform android --profile production --auto-submit`

Reference: https://docs.expo.dev/submit/android/

### 5d. Closed test (Personal accounts only)
1. **Testing > Closed testing > Create track**, upload the same release.
2. Recruit **at least 12 testers** (employees, family, customers). Add their Gmail addresses to the tester list.
3. Each tester opens the opt-in link, joins, installs the app and **stays opted in for 14 consecutive days**.
   Ask them to actually open and use the app; Google checks engagement.
4. After 14 days, Dashboard > **Apply for production** and answer the questions about your test.

Reference: https://support.google.com/googleplay/android-developer/answer/14151465

**Checkpoint:** production access approved.

---

## Phase 6: Production release

1. **Production > Create new release**, select the latest build, write release notes.
2. Choose countries (start with United States).
3. Submit for review (usually under 7 days for the first release, faster after).

---

## Optional: automatic builds from GitHub

Once Phases 3–5 work, Claude can add a GitHub Actions workflow so pushing to `main` builds and submits automatically.
You will add one repository secret: GitHub repo > **Settings > Secrets and variables > Actions > New repository secret**,
name `EXPO_TOKEN`, value from https://expo.dev/settings/access-tokens

## iPhone later

Everything above also prepares iOS. When you want iPhones: join the Apple Developer Program ($99/year,
https://developer.apple.com/programs) and run `eas build --platform ios`. No Mac is needed.

## Accounts checklist

| Service | Owner | Tweltz1 invited |
|---|---|---|
| GitHub repo | aarsvoldnathan | Yes |
| Supabase org | | |
| Expo org | | |
| Google Play Console | | |
