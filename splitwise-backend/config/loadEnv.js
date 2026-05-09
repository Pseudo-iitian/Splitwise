const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function loadEnv() {
  const envName = process.env.NODE_ENV || 'development';
  const envPath = path.resolve(__dirname, `../.env.${envName}`);
  const fallbackPath = path.resolve(__dirname, '../.env');
  const selectedPath = fs.existsSync(envPath) ? envPath : fallbackPath;

  dotenv.config({ path: selectedPath });

  process.env.APP_ENV = envName;
  process.env.LOADED_ENV_FILE = path.basename(selectedPath);

  return { envName, path: selectedPath };
}

module.exports = loadEnv;
