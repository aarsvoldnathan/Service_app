import Constants from 'expo-constants';

export const GITHUB_REPO = 'aarsvoldnathan/Service_app';
/** Page with the newest Android app file. */
export const ANDROID_DOWNLOAD = `https://github.com/${GITHUB_REPO}/releases/latest`;

/** Android build number, stamped into app.json by the GitHub Android build. 0 when running from a computer. */
export const ANDROID_BUILD: number = Number((Constants.expoConfig?.extra as { androidBuild?: number } | undefined)?.androidBuild ?? 0);
