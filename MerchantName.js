const axios = require('axios');
const fs = require('fs');
const { google } = require('googleapis');
const cheerio = require('cheerio');

// Your Google Sheets API credentials object
const credentials = require('/Users/mrhalder/Desktop/Folders/D2C Universe Dataset/API Key/Get_Ecom.json');

// Your Google Sheets document ID
const spreadsheetId = '1TksXrhToOh_20h3Q_Qxh2Bjl16c7yrx2okZjZ2fEqEU';

async function updateSheet(range, values, auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });
  } catch (error) {
    console.error('Error updating Google Sheet:', error.message);
  }
}

async function readSheet(range, auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return response.data.values;
}

async function getOgSiteName(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const metaTag = $('meta[property="og:site_name"]');
    return metaTag.attr('content') || null;
  } catch (error) {
    console.error(`Error fetching data from ${url}: ${error.message}`);
    return null;
  }
}

async function processBatch(urls, start, batchSize, auth) {
  const batchPromises = [];

  for (let i = start; i < Math.min(start + batchSize, urls.length); i++) {
    const url = urls[i];
    const modifiedUrl = 'https://' + url[0];
    const promise = getOgSiteName(modifiedUrl)
      .then(siteName => [siteName || '']);

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

    const batchSize = 10;
    let start = 0;

    while (start < urls.length) {
      const processedData = await processBatch(urls, start, batchSize, auth);

      // Write the processed data to Column D starting from the current row
      const outputRange = `JS_Script_VS!D${start + 2}:D${start + 2 + processedData.length - 1}`;
      await updateSheet(outputRange, processedData, auth);

      start += batchSize;

      console.log(`Processed ${start} URLs out of ${urls.length}.`);
    }

    console.log('Processing completed.');
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
