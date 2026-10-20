import Constants from 'expo-constants';

export const GITHUB_REPO = 'aarsvoldnathan/Service_app';
/** Page with the newest Android app file. */
export const ANDROID_DOWNLOAD = `https://github.com/${GITHUB_REPO}/releases/latest`;

/** Android build number, stamped into app.json by the GitHub Android build. 0 when running from a computer. */
export const ANDROID_BUILD: number = Number((Constants.expoConfig?.extra as { androidBuild?: number } | undefined)?.androidBuild ?? 0);

/** Online database (Supabase). The publishable key is safe to ship in the app: what each
 *  person can see is enforced by the database's row-level security rules. */
export const SUPABASE_URL = 'https://hzicabjeqprtiolsvxbn.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_bkRnSBIB_893PTxXdrKDLg_Ab9oRXAN';

/** Microsoft app (client) ID for the live Excel/OneDrive link. Not a secret. Leave empty to enter it in
 *  the app (Settings › Excel spreadsheet) instead. Setup steps: docs/EXCEL_SETUP.md. */
export const MS_CLIENT_ID = '';
