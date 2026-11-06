const { execSync } = require('child_process');

function localCommit() {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

// Commit corto para el sello de Perfil: en un build lo da EAS; en un `eas update`, el git local.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    gitCommit: (process.env.EAS_BUILD_GIT_COMMIT_HASH || localCommit() || config.extra?.gitCommit || 'dev').slice(0, 7),
  },
});
