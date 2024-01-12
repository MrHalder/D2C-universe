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

async function scrapeSocialMediaURLs(url) {
  try {
    // Add "https://" to the URL if it doesn't start with it
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      url = 'https://' + url;
    }

    console.log(`Fetching data from ${url}`);
    const response = await axios.get(url);
    console.log(`Fetched data from ${url}`);

    const $ = cheerio.load(response.data);

    // Extract social media URLs if available
    const instagramUrl = $('a.social_media_link_footer[href*="instagram.com"]').attr('href') || $('a[href*="instagram.com"]').attr('href') || '';
    const facebookUrl = $('a.social_media_link_footer[href*="facebook.com"]').attr('href') || $('a[href*="facebook.com"]').attr('href') || '';
    const twitterUrl = $('a.social_media_link_footer[href*="twitter.com"]').attr('href') || $('a[href*="twitter.com"]').attr('href') || '';
    const youtubeUrl = $('a.social_media_link_footer[href*="youtube.com"]').attr('href') || $('a[href*="youtube.com"]').attr('href') || '';
    const whatsappUrl = $('a.social_media_link_footer[href*="whatsapp.com"]').attr('href') || $('a[href*="whatsapp.com"]').attr('href') || '';

    console.log(`Instagram: ${instagramUrl}`);
    console.log(`Facebook: ${facebookUrl}`);
    console.log(`Twitter: ${twitterUrl}`);
    console.log(`YouTube: ${youtubeUrl}`);
    console.log(`WhatsApp: ${whatsappUrl}`);

    return [instagramUrl, facebookUrl, twitterUrl, youtubeUrl, whatsappUrl];
  } catch (error) {
    if (error.response) {
      // The request was made, but the server responded with a status code outside the range of 2xx
      console.error(`HTTP Error (${url}): ${error.response.status} - ${error.response.statusText}`);
    } else if (error.code === 'EPROTO') {
      // SSL/TLS handshake failure
      console.error(`SSL Handshake Failure (${url}): ${error.message}`);
    } else {
      console.error(`Error fetching data from ${url}: ${error.message}`);
    }
    
    return ['', '', '', '', ''];
  }
}

async function processBatch(urls, start, batchSize, auth) {
  const batchPromises = [];

  for (let i = start; i < Math.min(start + batchSize, urls.length); i++) {
    const url = urls[i][0];
    const promise = scrapeSocialMediaURLs(url);
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
      const processedData = await processBatch(urls, start, batchSize, auth);

      // Write the processed data to Columns E, F, G, H, I starting from the current row
      const outputRange = `JS_Script_VS!E${start + 2}:I${start + 2 + processedData.length - 1}`;
      await updateSheet(outputRange, processedData, auth);

      start += batchSize;

      console.log(`Processed ${start} URLs out of ${urls.length}.`);
    }

    console.log('Processing completed.');
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
