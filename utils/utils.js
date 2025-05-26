

function formatDimensions(obj) {
  if (!obj || !obj.length || !obj.width || !obj.height) return "";

  const length = Number(obj.length);
  const width = Number(obj.width);
  const height = Number(obj.height);

  if (isNaN(length) || isNaN(width) || isNaN(height)) return "";

  return `${length} x ${width} x ${height}`;
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
function removeTrailingZeros(value) {
  return value.replace(/\.?0+$/, ""); // Убирает .00, .0, .000 и т.п.
}
module.exports = { formatDimensions, sleep, removeTrailingZeros};
