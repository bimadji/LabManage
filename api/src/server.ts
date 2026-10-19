import { createApp } from './app.js';
import { loadConfig, loadEnvFile } from './config.js';

loadEnvFile();
const config = loadConfig();

createApp().listen(config.port, () => {
  console.log(`LabManage API berjalan di http://localhost:${config.port}`);
});
