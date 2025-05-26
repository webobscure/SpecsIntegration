// createShopifyClient.js
const axios = require("axios");

function createShopifyClient({ shopName, apiVersion, apiKey, apiPassword }) {
  return axios.create({
    baseURL: `https://${shopName}.myshopify.com/admin/api/${apiVersion}/`,
    auth: {
      username: apiKey,
      password: apiPassword,
    },
    headers: {
      "Content-Type": "application/json",
    },
  });
}

module.exports = createShopifyClient;
