#!/usr/bin/env node

/**
 * Reddit Post Scraper
 *
 * This script fetches Reddit posts related to a given search query using RapidAPI.
 * Requires a RapidAPI key to be set in the .env file as RAPIDAPI_KEY.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('query', {
    alias: 'q',
    description: 'Search query for Reddit posts',
    type: 'string',
    demandOption: true
  })
  .option('max', {
    alias: 'm',
    description: 'Maximum number of posts to fetch',
    type: 'number',
    default: 5
  })
  .option('sort', {
    alias: 's',
    description: 'Sort method for Reddit posts',
    type: 'string',
    choices: ['RELEVANCE', 'HOT', 'TOP', 'NEW', 'COMMENTS'],
    default: 'RELEVANCE'
  })
  .option('time', {
    alias: 't',
    description: 'Time period for Reddit posts',
    type: 'string',
    choices: ['all', 'year', 'month', 'week', 'day', 'hour'],
    default: 'month'
  })
  .option('output', {
    alias: 'o',
    description: 'Output JSON file path',
    type: 'string',
    default: './output/reddit-posts.json'
  })
  .option('debug', {
    alias: 'd',
    description: 'Enable debug mode for more detailed logs',
    type: 'boolean',
    default: false
  })
  .help()
  .argv;

/**
 * Extract the text content from various Reddit post formats
 * @param {Object} content - The content object from the Reddit API
 * @returns {string} - The extracted text content
 */
function extractTextFromContent(content) {
  if (!content) return '';

  // If content is directly a string
  if (typeof content === 'string') return content;

  // Check if content has text property
  if (content.text) return content.text;

  // Check if content is in selftext
  if (content.selftext) return content.selftext;

  // Check for image with alt text
  if (content.image && content.image.altText) {
    return `[Image: ${content.image.altText}]`;
  }

  // Check for gallery
  if (content.gallery && Array.isArray(content.gallery)) {
    return `[Gallery with ${content.gallery.length} images]`;
  }

  // Check for video
  if (content.video && content.video.url) {
    return `[Video: ${content.video.url}]`;
  }

  // Check for link
  if (content.link && content.link.url) {
    return `[Link: ${content.link.url}]`;
  }

  return 'No text content available';
}

/**
 * Extract subreddit name from various formats
 * @param {Object|string} subreddit - The subreddit object or string from the Reddit API
 * @returns {string} - The extracted subreddit name
 */
function extractSubredditName(subreddit) {
  if (!subreddit) return '';

  // If subreddit is directly a string
  if (typeof subreddit === 'string') return subreddit;

  // If subreddit is an object with name
  if (subreddit.name) return subreddit.name;

  // If subreddit is an object with title
  if (subreddit.title) return subreddit.title;

  return '';
}

/**
 * Extract author name from various formats
 * @param {Object|string} author - The author object or string from the Reddit API
 * @returns {string} - The extracted author name
 */
function extractAuthorName(author) {
  if (!author) return 'Unknown Author';

  // If author is directly a string
  if (typeof author === 'string') return author;

  // If author is an object with name
  if (author.name) return author.name;

  return 'Unknown Author';
}

/**
 * Fetch Reddit posts related to a topic using RapidAPI
 * @param {Object} options - Options for fetching Reddit posts
 * @param {string} options.query - The topic to search for
 * @param {number} options.max - Maximum number of posts to fetch
 * @param {string} options.sort - Sort method for posts
 * @param {string} options.time - Time period for posts
 * @param {boolean} options.debug - Enable debug mode
 * @returns {Promise<Array>} - Array of Reddit posts
 */
async function fetchRedditPosts(options) {
  const { query, max = 5, sort = 'RELEVANCE', time = 'month', debug = false } = options;

  // Verify that we have an API key
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.error('RAPIDAPI_KEY is not set in .env file');
    return [];
  }

  // Limit to requested number of posts (max 10 for free API tier)
  const limit = Math.min(max, 10);

  console.log(`Fetching up to ${limit} Reddit posts about "${query}"...`);

  try {
    if (debug) {
      console.log('RapidAPI Request Details:');
      console.log(`URL: https://reddit-scraper2.p.rapidapi.com/search_media_v3`);
      console.log(`Params: query=${query}, sort=${sort}, time=${time}, nsfw=0`);
      console.log(`API Key (first 5 chars): ${apiKey.substring(0, 5)}...`);
    }

    const response = await axios.request({
      method: 'GET',
      url: 'https://reddit-scraper2.p.rapidapi.com/search_media_v3',
      params: {
        query: query,
        sort: sort,
        time: time,
        nsfw: '0'
      },
      headers: {
        'x-rapidapi-host': 'reddit-scraper2.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      }
    });

    if (debug) {
      console.log(`Response status: ${response.status}`);
      console.log(`Response headers:`, response.headers);
    }

    if (response.status !== 200) {
      console.error(`Received status code ${response.status} from Reddit API`);
      return [];
    }

    // Process the response data
    const data = response.data;

    if (debug) {
      console.log('Response data structure:');
      console.log(JSON.stringify(data, null, 2).substring(0, 500) + '...');
      console.log(`Has data property: ${data && typeof data === 'object'}`);
      console.log(`Has data.data property: ${data && data.data !== undefined}`);
      console.log(`data.data is array: ${data && data.data && Array.isArray(data.data)}`);
      if (data && data.data && Array.isArray(data.data)) {
        console.log(`data.data length: ${data.data.length}`);
      }
    }

    if (!data) {
      console.error('No data received from Reddit API');
      return [];
    }

    // Get the posts from the data structure
    let redditPosts = [];

    // The API returns data in the data.data array
    if (data.data && Array.isArray(data.data)) {
      redditPosts = data.data.slice(0, limit);
    } else {
      console.log('No Reddit posts found in the API response');
      return [];
    }

    if (debug && redditPosts.length > 0) {
      console.log(`Found ${redditPosts.length} potential Reddit posts in response`);
      console.log('First post structure:');
      console.log(JSON.stringify(redditPosts[0], null, 2));
    }

    // Extract relevant information from each post
    const posts = redditPosts.map(post => {
      // Extract text content from the post
      const extractedContent = extractTextFromContent(post.content);

      // Create a formatted content string with additional info if available
      let formattedContent = extractedContent;

      // If there's no text content, try to create a useful summary from post metadata
      if (!extractedContent || extractedContent === 'No text content available') {
        formattedContent = `Reddit post titled "${post.title}" `;

        // Add image info if available
        if (post.content && post.content.image && post.content.image.url) {
          formattedContent += `with image: ${post.content.image.url} `;
        }

        // Add video info if available
        if (post.content && post.content.video && post.content.video.url) {
          formattedContent += `with video: ${post.content.video.url} `;
        }

        // Add link info if available
        if (post.content && post.content.link && post.content.link.url) {
          formattedContent += `with link: ${post.content.link.url} `;
        }

        // Add metadata
        formattedContent += `posted by u/${extractAuthorName(post.author)} in r/${extractSubredditName(post.subreddit)} with ${post.score || post.upvotes || 0} upvotes and ${post.comments || 0} comments.`;
      }

      // Extract creation date
      const created = post.creationDate ?
        new Date(post.creationDate).toISOString() :
        (post.created ? new Date(post.created * 1000).toISOString() : new Date().toISOString());

      return {
        title: post.title || 'No title available',
        subreddit: extractSubredditName(post.subreddit),
        author: extractAuthorName(post.author),
        upvotes: post.score || post.upvotes || 0,
        comments: post.comments || 0,
        content: formattedContent,
        url: post.url || '',
        created: created,
        platform: 'Reddit',
        source: 'Reddit'
      };
    });

    // Filter out any posts with no title or content
    const validPosts = posts.filter(post => post.title && post.content);

    console.log(`Found ${validPosts.length} Reddit posts.`);
    return validPosts;
  } catch (error) {
    console.error('Error fetching Reddit posts:', error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response headers:', error.response.headers);
      if (debug && error.response.data) {
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error details:', error.stack);
    }
    return [];
  }
}

async function main() {
  try {
    const { query, max, sort, time, output, debug } = argv;

    // Fetch Reddit posts
    const posts = await fetchRedditPosts({
      query,
      max,
      sort,
      time,
      debug
    });

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(output);
    fs.mkdirSync(outputDir, { recursive: true });

    // Write posts to file
    fs.writeFileSync(output, JSON.stringify(posts, null, 2));

    if (posts.length > 0) {
      console.log(`Successfully saved ${posts.length} Reddit posts to ${output}`);
    } else {
      console.log(`No Reddit posts found. Saved empty array to ${output}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
