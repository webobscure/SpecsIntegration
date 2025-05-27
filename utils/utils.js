function formatDimensions(obj, isInches = false, shouldMultiplyBy10 = false) {
  if (!obj || !obj.length || !obj.width || !obj.height) return "";

  let length = Number(obj.length);
  let width = Number(obj.width);
  let height = Number(obj.height);

  if (isNaN(length) || isNaN(width) || isNaN(height)) return "";

  if (shouldMultiplyBy10) {
    length *= 10;
    width *= 10;
    height *= 10;
  }

  if (isInches) {
    length = +(length * 0.04).toFixed(1);
    width = +(width * 0.04).toFixed(1);
    height = +(height * 0.04).toFixed(1);
  }

  return `${length} x ${width} x ${height}`;
}



function convertKgToLbs(kg) {
  return +(kg * 2.205).toFixed(2);
}


function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
function removeTrailingZeros(value) {
  return value.replace(/\.?0+$/, ""); // Убирает .00, .0, .000 и т.п.
}
module.exports = { formatDimensions,convertKgToLbs, sleep, removeTrailingZeros};
