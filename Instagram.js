const axios = require('axios');
const { google } = require('googleapis');
const cheerio = require('cheerio');

// Your Google Sheets API credentials object
const credentials = require('/Users/mrhalder/Desktop/Folders/D2C Universe Dataset/API Key/Get_Ecom.json');

// Your Google Sheets document ID
const spreadsheetId = '1TksXrhToOh_20h3Q_Qxh2Bjl16c7yrx2okZjZ2fEqEU';

async function updateSheet(range, values, auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  try {
    const stringValues = values.map(row => row.map(cell => cell.toString())); // Convert numbers to strings
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: { values: stringValues }, // Use string values
    });

    console.log(`Updated Google Sheet successfully. Range: ${range}`);
  } catch (error) {
    console.error('Error updating Google Sheet:', error.message);
  }
}

async function readSheet(range, auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return response.data.values;
  } catch (error) {
    console.error('Error reading Google Sheet:', error.message);
    throw error;
  }
}

async function getOgDescription(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const metaTag = $('meta[property="og:description"]');
    
    // Extract content from the og:description tag
    const content = metaTag.attr('content') || '';
    return content;
  } catch (error) {
    console.error(`Error fetching data from ${url}:`, error);
    return '';
  }
}

async function processBatch(urls, start, batchSize, auth) {
  const batchPromises = [];

  for (let i = start; i < Math.min(start + batchSize, urls.length); i++) {
    const url = urls[i][0]; // Extract the URL from the array
    const modifiedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : 'https://' + url;

    const promise = getOgDescription(modifiedUrl)
      .then((ogDescription) => {
        const match = ogDescription.match(/(\d{1,3}(,\d{3})*(\.\d+)?)[^\d]*(\d{1,3}(,\d{3})*(\.\d+)?)[^\d]*(\d{1,3}(,\d{3})*(\.\d+)?)/);

        if (match) {
          const followersCount = match[1] ? parseFloat(match[1].replace(/,/g, '')) || 0 : 0;
          const followingCount = match[5] ? parseFloat(match[5].replace(/,/g, '')) || 0 : 0;
          const numberOfPosts = match[9] ? parseFloat(match[9].replace(/,/g, '')) || 0 : 0;

          return [followersCount, followingCount, numberOfPosts];
        }

        // Return an empty array if values are not valid
        return [0, 0, 0];
      });

    // Add a delay between requests (e.g., 1 second)
    batchPromises.push(promise.then(result => new Promise(resolve => setTimeout(() => resolve(result), 1000))));
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
    const range = 'Instagram_Script_VS!A2:A'; // Adjust the range as per your sheet
    const urls = await readSheet(range, auth);

    const batchSize = 1; // Set batch size to 1 to process one URL at a time
    let start = 0;

    const processedData = await processBatch(urls, start, batchSize, auth);

    // Write the processed data to Columns B, C, and D starting from the current row
    const outputRange = `Instagram_Script_VS!B${start + 2}:D${start + 2 + processedData.length - 1}`;
    await updateSheet(outputRange, processedData, auth);

    console.log('Processing completed.');
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
