require('dotenv').config();
const cron = require('node-cron');
const { exec } = require('child_process');
const fs = require('fs');

const logFile = './cron_output.log';

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
}

// Запускаем каждый день в 7 вечера(только на 27.05.2025)
cron.schedule('30 7 * * *', () => {
  log('⏱ Запуск updater.js...');

  exec('node updater.js', (error, stdout, stderr) => {
    if (error) {
      log(`❌ Ошибка: ${error.message}`);
      return;
    }
    if (stderr) {
      log(`⚠️ Предупреждение: ${stderr}`);
    }
    log(`✅ Успех:\n${stdout}`);
  });
});

log('🟢 Планировщик cron инициализирован.');
