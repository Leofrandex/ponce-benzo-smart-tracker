import Constants from 'expo-constants';

export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';
export const GIT_COMMIT: string =
  (Constants.expoConfig?.extra as { gitCommit?: string } | undefined)?.gitCommit ?? 'dev';
export const VERSION_STAMP = `v${APP_VERSION} · ${GIT_COMMIT}`;
