#!/usr/bin/env node

/**
 * Tavily News Article Scraper
 *
 * This script fetches news articles from Tavily API related to a given search query.
 * Requires a Tavily API key to be set in the .env file as TAVILY_API_KEY.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
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
    default: './output/tavily-articles.json'
  })
  .help()
  .argv;

// Initialize Tavily client
let tavilyClient = null;

/**
 * Initialize Tavily client
 * @returns {Promise<boolean>} - Whether the initialization was successful
 */
async function initTavily() {
  if (!process.env.TAVILY_API_KEY) {
    console.error('TAVILY_API_KEY is not set in .env file');
    return false;
  }

  try {
    const tavilyModule = await import('tavily');

    // Based on the output, we know the module has TavilyClient and tavily properties
    if (tavilyModule.TavilyClient) {
      tavilyClient = new tavilyModule.TavilyClient({
        apiKey: process.env.TAVILY_API_KEY,
      });
      console.log('Tavily API initialized successfully (TavilyClient).');
      return true;
    } else if (tavilyModule.tavily) {
      tavilyClient = new tavilyModule.tavily({
        apiKey: process.env.TAVILY_API_KEY,
      });
      console.log('Tavily API initialized successfully (tavily).');
      return true;
    } else if (tavilyModule.default) {
      tavilyClient = new tavilyModule.default({
        apiKey: process.env.TAVILY_API_KEY,
      });
      console.log('Tavily API initialized successfully (default).');
      return true;
    } else {
      console.error('Failed to initialize Tavily API: Unsupported module structure', Object.keys(tavilyModule));
      return false;
    }
  } catch (error) {
    console.error('Failed to initialize Tavily API:', error.message);
    return false;
  }
}

/**
 * Fetch news articles related to a topic using Tavily
 * @param {string} query - The topic to search for
 * @param {number} max - Maximum number of articles to fetch
 * @returns {Promise<Array>} - Array of news articles
 */
async function fetchTavilyNewsArticles(query, max = 5) {
  if (!tavilyClient) {
    console.error('Tavily client is not initialized');
    return [];
  }

  max = Math.min(max, 5); // Limit to 5 articles max
  console.log(`Fetching up to ${max} news articles from Tavily about "${query}"...`);

  try {
    const response = await tavilyClient.search({
      query: `latest news about ${query}`,
      search_depth: "advanced",
      include_domains: ["news.google.com", "cnn.com", "bbc.com", "reuters.com", "bloomberg.com", "nytimes.com", "wsj.com", "theguardian.com", "apnews.com", "npr.org"],
      max_results: max,
      include_answer: false,
      include_raw_content: false,
    });

    if (response && response.results && response.results.length > 0) {
      const articles = response.results.map(result => ({
        title: result.title || 'No title available',
        link: result.url,
        description: result.content || result.snippet || 'No description available',
        pubDate: new Date().toISOString(), // Tavily doesn't provide dates, use current date
        platform: 'News',
        source: 'Tavily Search'
      }));

      console.log(`Found ${articles.length} news articles from Tavily.`);
      return articles;
    } else {
      console.log('No news articles found from Tavily.');
      return [];
    }
  } catch (error) {
    console.error('Error fetching Tavily news articles:', error.message);
    return [];
  }
}

async function main() {
  try {
    const { query, max, output } = argv;

    // Initialize Tavily
    const initialized = await initTavily();
    if (!initialized) {
      console.error('Could not initialize Tavily. Make sure you have set TAVILY_API_KEY in your .env file.');
      process.exit(1);
    }

    // Fetch news articles
    const articles = await fetchTavilyNewsArticles(query, max);

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(output);
    fs.mkdirSync(outputDir, { recursive: true });

    // Write articles to file
    fs.writeFileSync(output, JSON.stringify(articles, null, 2));

    if (articles.length > 0) {
      console.log(`Successfully saved ${articles.length} news articles to temp-tavily-articles.json`);
    } else {
      console.log(`No articles found. Saved empty array to temp-tavily-articles.json`);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
