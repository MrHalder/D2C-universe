const axios = require('axios');
const { google } = require('googleapis');

// Your Google Sheets API credentials object
const credentials = require('/Users/mrhalder/Desktop/Folders/D2C Universe Dataset/API Key/Get_Ecom.json');

// Your Google Sheets document ID
const spreadsheetId = '1TksXrhToOh_20h3Q_Qxh2Bjl16c7yrx2okZjZ2fEqEU';

const urlCache = new Map();

async function getStatusCode(url) {
  const url_trimmed = url.trim();

  // Check if the URL is in the cache
  if (urlCache.has(url_trimmed)) {
    return urlCache.get(url_trimmed);
  }

  // If not in the cache, fetch a new request to the URL using axios
  try {
    const responsePromise = axios.head(url_trimmed, { maxRedirects: 0 });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 20000) // 20 seconds timeout
    );

    const response = await Promise.race([responsePromise, timeoutPromise]);
    const responseCode = response.status;

    // Store the response code for the URL in the cache for subsequent retrievals
    urlCache.set(url_trimmed, responseCode);
    return responseCode;
  } catch (error) {
    // Ignore specific error messages and return a predefined status code
    if (error.message.includes("Hostname/IP does not match certificate's")) {
      console.warn(`Ignoring error for URL ${url_trimmed}:`, error.message);
      return 404; // Assume 404 for URLs with ignored errors
    } else if (error.response && error.response.status) {
      // Store the response code for the URL in the cache for subsequent retrievals
      urlCache.set(url_trimmed, error.response.status);
      return error.response.status;
    } else {
      // Log an error message for other types of errors
      console.error(`Error fetching URL ${url_trimmed}:`, error.message);
      return null;
    }
  }
}

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

async function processBatchUrls(urls) {
  try {
    // Use the getStatusCode function to get the status codes for the batch
    const statusCodes = await Promise.all(urls.map(url => getStatusCode(url)));

    // Process the status codes as needed
    return statusCodes;
  } catch (error) {
    // Log an error message if there's an issue processing the batch
    console.error('Error processing batch URLs:', error.message);
    return Array(urls.length).fill(null);
  }
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

    // Process URLs in batches of 100
    const batchSize = 100;
    let processedCount = 0;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batchUrls = urls.slice(i, i + batchSize).map(url => 'https://' + url[0]);
      const statusCodes = await processBatchUrls(batchUrls);

      // Increment the processed count by the number of URLs in the current batch
      processedCount += batchUrls.length;

      // Log the processed count
      console.log(`Processed ${processedCount} from ${urls.length} URLs.`);

      // Write the status codes to column C starting from row 2
      const outputRange = `JS_Script_VS!C${i + 2}:C${i + batchSize + 1}`; // Adjust the range as per your sheet
      await updateSheet(outputRange, statusCodes.map(code => [code]), auth);
    }

    console.log('Processing completed.');
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
