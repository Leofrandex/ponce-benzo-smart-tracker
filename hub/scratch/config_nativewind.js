const fs = require('fs');
const path = require('path');

const mobileDir = path.resolve(__dirname, '..', '..', 'mobile');

// Create babel.config.js
const babelPath = path.join(mobileDir, 'babel.config.js');
const babelContent = `module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ["nativewind/babel"],
  };
};`;
fs.writeFileSync(babelPath, babelContent);
console.log('Created babel.config.js');
