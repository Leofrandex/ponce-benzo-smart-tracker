import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';
export const GIT_COMMIT: string =
  (Constants.expoConfig?.extra as { gitCommit?: string } | undefined)?.gitCommit ?? 'dev';
// app_version no cambia con un OTA: esto dice qué actualización corre. 'embebido' = el código del APK.
export const OTA_ID: string = Updates.updateId ?? 'embebido';
export const VERSION_STAMP = `v${APP_VERSION} · ${GIT_COMMIT}`;
