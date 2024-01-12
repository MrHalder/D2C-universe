const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
const { google } = require('googleapis');

// Your Google Sheets API credentials object
const credentials = require('/Users/mrhalder/Desktop/Folders/D2C Universe Dataset/API Key/Get_Ecom.json');

// Your Google Sheets document ID
const spreadsheetId = '1TksXrhToOh_20h3Q_Qxh2Bjl16c7yrx2okZjZ2fEqEU';

async function updateSheet(range, values, auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: { values },
  });
}

async function readSheet(range, auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return response.data.values;
}

async function processUrl(url) {
  try {
    const response = await axios.get(url, { timeout: 20000 });
    return getEcommercePlatform(response.data);
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log(`URL ${url} Skipped - Timeout`);
    }
    return null;
  }
}

function getEcommercePlatform(source) {
  if (source.includes("Shopify.theme")) {
    return "Shopify";
  } else if (source.includes("WooCommerce")) {
    return "WooCommerce";
  } else if (source.includes("magento")) {
    return "Magento";
  } else if (source.includes("osCsid")) {
    return "osCommerce";
  } else if (source.includes("zenid")) {
    return "Zen Cart";
  } else if (source.includes("PrestaShop")) {
    return "PrestaShop";
  } else if (source.includes("BigCommerce")) {
    return "BigCommerce";
  } else if (source.includes("opencart")) {
    return "OpenCart";
  } else {
    return "Custom";
  }
}

async function processBatch(urls, start, batchSize) {
  const batchPromises = [];

  for (let i = start; i < Math.min(start + batchSize, urls.length); i++) {
    const url = urls[i];
    const modifiedUrl = 'https://' + url[0];
    const promise = processUrl(modifiedUrl)
      .then(platform => [platform || '']);

    batchPromises.push(promise);
  }

  return Promise.all(batchPromises);
}

(async () => {
  try {
    // Set up authentication using credentials object directly
    const auth = await google.auth.getClient({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // Read URLs from the Google Sheet (assuming URLs are in column A starting from row 2)
    const range = 'JS_Script_VS!A2:A'; // Adjust the range as per your sheet
    const urls = await readSheet(range, auth);

    const batchSize = 100;
    let start = 0;

    while (start < urls.length) {
      const processedData = await processBatch(urls, start, batchSize);

      // Write the processed data to the next column (B column) starting from the current row
      const outputRange = `JS_Script_VS!B${start + 2}:B${start + 2 + processedData.length - 1}`;
      await updateSheet(outputRange, processedData, auth);

      start += batchSize;

      console.log(`Processed ${start} URLs out of ${urls.length}.`);
    }

    console.log('Processing completed.');
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
