require('dotenv').config();
const cron = require('node-cron');
const { spawn } = require('child_process');
const fs = require('fs');
const chalk = require('chalk'); 

const logFile = './cron_output.log';

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
}

// Планировщик: каждую субботу в 8:00 0 8 * * 6
cron.schedule('35 14 * * 2', () => {
  log('⏱ Запуск updater.js...');

  const child = spawn('node', ['updater.js']);

  // STDOUT: зеленый live-вывод и лог
  child.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text) {
      console.log(chalk.green(text)); // зеленый live вывод
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] STDOUT: ${text}\n`);
    }
  });

  // STDERR: красный live-вывод и лог
  child.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) {
      console.error(chalk.red(text)); // красный live вывод ошибок
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] STDERR: ${text}\n`);
    }
  });

  child.on('error', (error) => {
    log(`❌ Ошибка процесса: ${error.message}`);
  });

  child.on('close', (code) => {
    log(`🔚 updater.js завершён с кодом ${code}`);
  });
});

log('🟢 Планировщик cron инициализирован.');
