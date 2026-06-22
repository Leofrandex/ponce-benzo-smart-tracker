// Inyecta el commit corto en extra.gitCommit en cada build EAS (OTA está apagado).
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    gitCommit: (process.env.EAS_BUILD_GIT_COMMIT_HASH || config.extra?.gitCommit || 'dev').slice(0, 7),
  },
});
