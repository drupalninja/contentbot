#!/usr/bin/env node

/**
 * Bing News Article Scraper
 *
 * This script fetches news articles from Bing News related to a given search query.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('query', {
    alias: 'q',
    description: 'Search query for news articles',
    type: 'string',
    demandOption: true
  })
  .option('max', {
    alias: 'm',
    description: 'Maximum number of articles to fetch',
    type: 'number',
    default: 5
  })
  .option('output', {
    alias: 'o',
    description: 'Output JSON file path',
    type: 'string',
    default: './output/bing-articles.json'
  })
  .help()
  .argv;

/**
 * Fetch news articles related to a topic using Bing News
 * @param {string} query - The topic to search for
 * @param {number} max - Maximum number of articles to fetch
 * @returns {Promise<Array>} - Array of news articles
 */
async function fetchBingNewsArticles(query, max = 5) {
  max = Math.min(max, 5); // Limit to 5 articles max
  console.log(`Fetching up to ${max} news articles from Bing about "${query}"...`);

  return new Promise((resolve, reject) => {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.bing.com/news/search?q=${encodedQuery}&format=rss`;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      }
    };

    https.get(url, options, (res) => {
      let data = '';

      // Handle redirects and error status codes
      if (res.statusCode !== 200) {
        console.error(`Received status code ${res.statusCode} from Bing News API`);
        resolve([]);
        return;
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          console.log(`Received ${data.length} bytes of data from Bing News`);

          // First, check if we actually received RSS content
          if (!data.includes('<rss') && !data.includes('<item>')) {
            console.error('Response does not appear to be valid RSS content');
            resolve([]);
            return;
          }

          // Extract articles from RSS feed using a more robust regex
          const articles = [];

          // Two regex patterns to try
          const regexPatterns = [
            /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<description>(.*?)<\/description>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g,
            /<item>\s*<title>(.*?)<\/title>\s*<link>(.*?)<\/link>\s*<description>(.*?)<\/description>.*?<pubDate>(.*?)<\/pubDate>/gs
          ];

          // Try both patterns
          for (const pattern of regexPatterns) {
            let match;
            while ((match = pattern.exec(data)) !== null && articles.length < max) {
              if (match[1] && match[2] && match[3] && match[4]) {
                const title = match[1]
                  .replace(/&quot;/g, '"')
                  .replace(/&amp;/g, '&')
                  .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');

                const link = match[2]
                  .replace(/&amp;/g, '&');

                const description = match[3]
                  .replace(/&quot;/g, '"')
                  .replace(/&amp;/g, '&')
                  .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
                  .replace(/<.*?>/g, '');

                const pubDate = match[4];

                articles.push({
                  title,
                  link,
                  description,
                  pubDate,
                  platform: 'News',
                  source: 'Bing News'
                });
              }
            }

            // If we found articles with this pattern, stop trying
            if (articles.length > 0) {
              break;
            }
          }

          console.log(`Found ${articles.length} news articles from Bing.`);
          resolve(articles);
        } catch (error) {
          console.error('Error parsing Bing news articles:', error.message);
          resolve([]); // Return empty array on error
        }
      });
    }).on('error', (error) => {
      console.error('Error fetching Bing news articles:', error.message);
      resolve([]); // Return empty array on error
    });
  });
}

async function main() {
  try {
    const { query, max, output } = argv;

    // Fetch news articles
    const articles = await fetchBingNewsArticles(query, max);

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(output);
    fs.mkdirSync(outputDir, { recursive: true });

    // Write articles to file
    fs.writeFileSync(output, JSON.stringify(articles, null, 2));

    if (articles.length > 0) {
      console.log(`Successfully saved ${articles.length} news articles to temp-bing-articles.json`);
    } else {
      console.log(`No articles found. Saved empty array to temp-bing-articles.json`);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
