require("dotenv").config();
const axios = require("axios");
const fs = require("fs");

const logStream = fs.createWriteStream("./shopify_metafields.log", {
  flags: "a",
});
function logToFile(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  logStream.write(line + "\n");
}

// Создаем экземпляр axios с базовым URL и заголовками авторизации
const axiosInstance = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/${process.env.SHOPIFY_API_VERSION}/`,
  auth: {
    username: process.env.SHOPIFY_API_KEY,
    password: process.env.SHOPIFY_API_PASSWORD,
  },
  headers: {
    "Content-Type": "application/json",
  },
});

async function handleRateLimits(headers) {
  const callsLimit = headers["x-shopify-api-call-limit"];
  if (callsLimit) {
    const [callsMade, callsMax] = callsLimit.split("/").map(Number);
    const callsLeft = callsMax - callsMade;
    if (callsLeft < 3) {
      logToFile(
        `⏳ Лимит почти исчерпан (${callsLeft} вызовов осталось), ждём 1500 мс...`
      );
      await new Promise((res) => setTimeout(res, 1500));
    }
  }
}

// Форматируем размеры (длина x ширина x высота) * 10
function formatDimensions(obj) {
  if (!obj || !obj.length || !obj.width || !obj.height) return "";

  function processNumber(str) {
    if (typeof str !== "single_line_text_field") str = String(str);
    return str.includes(".") ? Number(str) * 10 : Number(str);
  }

  const length = processNumber(obj.length);
  const width = processNumber(obj.width);
  const height = processNumber(obj.height);

  if (isNaN(length) || isNaN(width) || isNaN(height)) return "";

  return `${length} x ${width} x ${height}`;
} 
async function updateOrCreateMetafield(productId, namespace, key, value) {
  try {
    // Проверяем, что значение не пустое
    if (!value || String(value).trim() === "") {
      logToFile(`⚠️ Пропущено обновление ${key} из-за пустого значения`);
      return;
    }

    // Получаем метафилды продукта
    const resp = await axiosInstance.get(
      `products/${productId}/metafields.json`
    );
    await handleRateLimits(resp.headers);
    const existing = resp.data.metafields;

    const found = existing.find(
      (m) => m.namespace === namespace && m.key === key
    );
    const safeValue = String(value).substring(0, 255);
    const valueType = "single_line_text_field"; // Можно поменять на number_integer/number_decimal при необходимости

    if (found) {
      // Обновляем метафилд
      await axiosInstance.put(`metafields/${found.id}.json`, {
        metafield: {
          id: found.id,
          value: safeValue,
          type: valueType,
        },
      });
      logToFile(`🔁 Обновлено у продукта с id ${found.id}: ${key} = ${safeValue}`);
    } else {
      // Создаем метафилд
      await axiosInstance.post(`products/${productId}/metafields.json`, {
        metafield: {
          namespace,
          key,
          value: safeValue,
          type: valueType,
        },
      });
      logToFile(`🆕 Создано: ${key} = ${safeValue}`);
    }
  } catch (err) {
    const errMsg = err.response?.data
      ? JSON.stringify(err.response.data, null, 2)
      : err.message;
    logToFile(
      `❌ Ошибка при обновлении/создании метафилда (${key}): ${errMsg}`
    );
  }
}

async function getProducts(since_id = 0, limit = 50) {
  try {
    const resp = await axiosInstance.get("products.json", {
      params: { limit, since_id },
    });
    await handleRateLimits(resp.headers);
    return resp.data.products || [];
  } catch (err) {
    const errMsg = err.response?.data
      ? JSON.stringify(err.response.data, null, 2)
      : err.message;
    logToFile(`❌ Ошибка получения продуктов: ${errMsg}`);
    return [];
  }
}

async function updateMetafieldsFromAPI() {
  try {
    let since_id = 0;
    const limit = 50;

    while (true) {
      const products = await getProducts(since_id, limit);
      if (products.length === 0) break;

      for (const product of products) {
        try {
          const resp = await axiosInstance.get(
            `products/${product.id}/metafields.json`
          );
          await handleRateLimits(resp.headers);
          const metafields = resp.data.metafields;

          const modelField = metafields.find(
            (f) => f.key === "modelnameformanual"
          );
          if (!modelField) {
            logToFile(`❌ У продукта ${product.title} нет modelnameformanual`);
            continue;
          }

          const modelName = modelField.value;

          let response;
          try {
            response = await axios.get(
              `https://shop.onkron.ru/get_cargo_data.php?model=${modelName}`
            );
          } catch (err) {
            logToFile(`⚠️ Ошибка API для ${modelName}: ${err.message}`);
            continue;
          }

          const data = response.data;
          const euro = data?.euro_palet;
          const qty20 = data?.["QTY 20 GP"];
          const qty40 = data?.["QTY 40 HQ"];

          if (!euro?.prodInfo) {
            logToFile(`⚠️ Нет prodInfo для ${modelName}`);
            continue;
          }

          const updates = [
            { key: "prod_dimensions", value: formatDimensions(euro.prodInfo) },
            {
              key: "pallet_dimensions",
              value: formatDimensions(euro.palletInfo),
            },
            {
              key: "weight_one_prod",
              value: euro.prodInfo.weightOneProd
                ? Number(euro.prodInfo.weightOneProd).toFixed(2)
                : null,
            },
            { key: "count_in_box", value: euro.prodInfo.countInBox },
            { key: "all_boxes", value: euro.allBoxes },
            {
              key: "total_weight",
              value: euro.totalWeight
                ? Number(euro.totalWeight).toFixed(2)
                : null,
            },
            { key: "qty_20gp_boxes", value: qty20?.allBoxes },
            { key: "qty_40hq_boxes", value: qty40?.allBoxes },
          ];

          for (const { key, value } of updates) {
            if (value != null && String(value).trim() !== "") {
              await updateOrCreateMetafield(
                product.id,
                "cargo_data",
                key,
                value
              );
              // Задержка между обновлениями метафилдов, чтобы не превышать лимиты
              await new Promise((res) => setTimeout(res, 600));
            }
          }

          // Задержка между продуктами, чтобы снизить нагрузку на API
          await new Promise((res) => setTimeout(res, 800));
        } catch (err) {
          logToFile(
            `❌ Ошибка при обработке продукта ${product.title}: ${err.message}`
          );
        }
      }

      since_id = products[products.length - 1].id;
    }

    logToFile("✅ Обновление завершено!");
  } catch (error) {
    const errMsg = error.response?.data
      ? JSON.stringify(error.response.data, null, 2)
      : error.message;
    logToFile(`❌ Ошибка выполнения скрипта: ${errMsg}`);
  }
}

updateMetafieldsFromAPI();
