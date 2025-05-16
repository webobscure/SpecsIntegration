require('dotenv').config();
const Shopify = require('shopify-api-node');
const axios = require('axios');
const fs = require('fs');

const logStream = fs.createWriteStream('./shopify_metafields.log', { flags: 'a' });
function logToFile(message) {
  const line = `[{new Date().toISOString()}] {message}`;
  console.log(line);
  logStream.write(line + '\n');
}

const shopify = new Shopify({
  shopName: process.env.SHOPIFY_SHOP_NAME,
  apiKey: process.env.SHOPIFY_API_KEY,
  password: process.env.SHOPIFY_API_PASSWORD,
  apiVersion: process.env.SHOPIFY_API_VERSION
});

async function handleRateLimits() {
  const callsLeft = shopify.callLimits.remaining;
  if (callsLeft < 5) {
    const resetIn = shopify.callLimits.reset || 1;
    logToFile(`⏳ Лимит почти исчерпан, ждём ${resetIn} сек...`);
    await new Promise(res => setTimeout(res, resetIn * 1000));
  }
}

function formatDimensions(obj) {
  return obj?.length && obj?.width && obj?.height
    ? `${obj.length * 10}x${obj.width * 10}x${obj.height * 10}`
    : '';
}

async function updateOrCreateMetafield(productId, namespace, key, value) {
  const existing = await shopify.metafield.list({
    metafield: { owner_resource: 'product', owner_id: productId }
  });

  const found = existing.find(m => m.namespace === namespace && m.key === key);
  const metafieldPayload = {
    key,
    value: String(value),
    value_type: 'string',
    namespace,
    owner_resource: 'product',
    owner_id: productId
  };

  if (found) {
    await shopify.metafield.update(found.id, { value: metafieldPayload.value });
    logToFile(`🔁 Обновлено: ${key} = ${value}`);
  } else {
    await shopify.metafield.create(metafieldPayload);
    logToFile(`🆕 Создано: ${key} = ${value}`);
  }
}

async function updateMetafieldsFromAPI() {
  try {
    let page = 1;
    const limit = 50;

    while (true) {
      const products = await shopify.product.list({ limit, page });
      if (products.length === 0) break;

      for (const product of products) {
        await handleRateLimits();

        const metafields = await shopify.metafield.list({
          metafield: { owner_resource: 'product', owner_id: product.id }
        });

        const modelField = metafields.find(f => f.key === 'modelnameformanual');
        if (!modelField) {
          logToFile(`❌ У продукта ${product.title} нет modelnameformanual`);
          continue;
        }

        const modelName = modelField.value;
        let response;
        try {
          response = await axios.get(`https://shop.onkron.ru/get_cargo_data.php?model=${modelName}`);
        } catch (err) {
          logToFile(`⚠️ Ошибка API для ${modelName}: ${err.message}`);
          continue;
        }

        const data = response.data;
        const euro = data?.euro_pallet;
        const qty20 = data?.["QTY 20 GP"];
        const qty40 = data?.["QTY 40 HQ"];

        if (!euro?.prodInfo) {
          logToFile(`⚠️ Нет prodInfo для ${modelName}`);
          continue;
        }

        const updates = [
          { key: 'prod_dimensions', value: formatDimensions(euro.prodInfo) },
          { key: 'pallet_dimensions', value: formatDimensions(euro.palletInfo) },
          { key: 'weight_one_prod', value: euro.prodInfo.weightOneProd },
          { key: 'count_in_box', value: euro.prodInfo.countInBox },
          { key: 'all_boxes', value: euro.prodInfo.allBoxes },
          { key: 'total_weight', value: euro.prodInfo.totalWeight },
          { key: 'qty_20gp_boxes', value: qty20?.allBoxes },
          { key: 'qty_40hq_boxes', value: qty40?.allBoxes }
        ];

        for (const { key, value } of updates) {
          if (value != null) {
            await handleRateLimits();
            await updateOrCreateMetafield(product.id, 'cargo_data', key, value);
          }
        }
      }

      page++;
    }

    logToFile('✅ Обновление завершено!');
  } catch (err) {
    logToFile('❌ Ошибка выполнения: ' + (err.response?.data || err.message));
  }
}

updateMetafieldsFromAPI();
