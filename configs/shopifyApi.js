require("dotenv").config();
const axios = require("axios");
const { logToFile } = require("../utils/logger");

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
      logToFile(`⏳ Почти лимит (${callsLeft}), ждём...`);
      await new Promise((res) => setTimeout(res, 1500));
    }
  }
}

async function getProducts(axiosInstance, since_id = 0, limit = 50) {
  try {
    const resp = await axiosInstance.get("products.json", {
      params: { limit, since_id },
    });
    await handleRateLimits(resp.headers);
    return resp.data.products || [];
  } catch (err) {
    logToFile(`❌ Ошибка получения продуктов: ${err.message}`);
    await new Promise((r) => setTimeout(r, 2000));
    return [];
  }
}

async function updateOrCreateMetafield(axiosInstance, productId, namespace, key, value) {
  try {
    if (!value || String(value).trim() === "") {
      logToFile(`⚠️ Пропущено ${key} из-за пустого значения`);
      return;
    }

    const resp = await axiosInstance.get(`products/${productId}/metafields.json`);
    await handleRateLimits(resp.headers);
    const existing = resp.data.metafields;
    const found = existing.find(m => m.namespace === namespace && m.key === key);

    const safeValue = String(value).substring(0, 255);
    const valueType = "single_line_text_field";

    if (found) {
      await axiosInstance.put(`metafields/${found.id}.json`, {
        metafield: { id: found.id, value: safeValue, type: valueType },
      });
      logToFile(`🔁 Обновлено: ${key} = ${safeValue}`);
    } else {
      await axiosInstance.post(`products/${productId}/metafields.json`, {
        metafield: { namespace, key, value: safeValue, type: valueType },
      });
      logToFile(`🆕 Создано: ${key} = ${safeValue}`);
    }
  } catch (err) {
    const msg = err.response?.data ? JSON.stringify(err.response.data, null, 2) : err.message;
    logToFile(`❌ Ошибка метафилда ${key}: ${msg}`);
  }
}


module.exports = {
  getProducts,
  updateOrCreateMetafield,
  axiosInstance,
  handleRateLimits
};
