const fs = require("fs");

const logStream = fs.createWriteStream("./shopify_metafields.log", {
  flags: "a",
});

function logToFile(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  logStream.write(line + "\n");
}

module.exports = { logToFile };