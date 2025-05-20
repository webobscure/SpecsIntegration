const axios = require("axios");
const { getProducts, updateOrCreateMetafield, axiosInstance, handleRateLimits } = require("./api");
const { formatDimensions, sleep, removeTrailingZeros } = require("./utils");
const { logToFile } = require("./logger");

async function updateMetafieldsFromAPI() {
  let since_id = 0;
  const limit = 50;

  while (true) {
    const products = await getProducts(since_id, limit);
    if (products.length === 0) break;

    for (const product of products) {
      try {
        const metafieldsResp = await axiosInstance.get(`products/${product.id}/metafields.json`);
        await handleRateLimits(metafieldsResp.headers);
        const metafields = metafieldsResp.data.metafields;

        const modelField = metafields.find((f) => f.key === "modelnameformanual");
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
        const individual = data?.individual;

        if (!euro?.prodInfo) {
          logToFile(`⚠️ Нет prodInfo для ${modelName}`);
          continue;
        }

        const updates = [
          { key: "prod_dimensions", value: formatDimensions(euro.prodInfo) },
          { key: "pallet_dimensions", value: formatDimensions(euro.palletInfo) },
          { key: "individual_dimensions", value: formatDimensions(individual) },
          {
            key: "weight_one_prod",
            value: euro.prodInfo.weightOneProd
              ? removeTrailingZeros(Number(euro.prodInfo.weightOneProd).toFixed(2))
              : null,
          },
          {
            key: "weight",
            value: euro.prodInfo.weight
              ? removeTrailingZeros(Number(euro.prodInfo.weight).toFixed(2))
              : null,
          },
          { key: "count_in_box", value: euro.prodInfo.countInBox },
          { key: "all_boxes", value: euro.allBoxes },
          {
            key: "total_weight",
            value: euro.totalWeight ? removeTrailingZeros(Number(euro.totalWeight).toFixed(2)) : null,
          },
          { key: "qty_20gp_boxes", value: qty20?.allBoxes },
          { key: "qty_40hq_boxes", value: qty40?.allBoxes },
        ];

        for (const { key, value } of updates) {
          await updateOrCreateMetafield(product.id, "cargo_data", key, value);
          await sleep(600);
        }

        await sleep(800);
      } catch (err) {
        logToFile(`❌ Ошибка обработки ${product.title}: ${err.message}`);
      }
    }

    since_id = products[products.length - 1].id;
  }

  logToFile("✅ Обновление завершено!");
}

updateMetafieldsFromAPI();
