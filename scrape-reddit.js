#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
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
    description: 'Maximum number of posts to fetch (1-25)',
    type: 'number',
    default: 5
  })
  .option('output', {
    alias: 'o',
    description: 'Output JSON file path',
    type: 'string',
    default: './output/reddit-posts.json'
  })
  .option('subreddit', {
    alias: 's',
    description: 'Specific subreddit to search in (optional)',
    type: 'string'
  })
  .option('sort', {
    description: 'Sort method (relevance, hot, new, top)',
    type: 'string',
    default: 'relevance',
    choices: ['relevance', 'hot', 'new', 'top']
  })
  .option('time', {
    alias: 't',
    description: 'Time period for results (hour, day, week, month, year, all)',
    type: 'string',
    default: 'week',
    choices: ['hour', 'day', 'week', 'month', 'year', 'all']
  })
  .help()
  .alias('help', 'h')
  .argv;

/**
 * Fetch Reddit posts related to a topic
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Array of Reddit posts
 */
async function fetchRedditPosts(options) {
  const { query, max, subreddit, sort, time } = options;
  const limit = Math.min(Math.max(1, max), 25); // Limit between 1 and 25

  console.log(`Fetching up to ${limit} Reddit posts about "${query}"...`);

  // Build the search URL
  let searchUrl;
  if (subreddit) {
    console.log(`Searching in r/${subreddit}...`);
    searchUrl = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json?q=${encodeURIComponent(query)}&restrict_sr=on&sort=${sort}&t=${time}&limit=${limit}`;
  } else {
    console.log(`Searching across all of Reddit...`);
    searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=${sort}&t=${time}&limit=${limit}`;
  }

  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    };

    https.get(searchUrl, options, (res) => {
      let data = '';

      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400) {
        console.log(`Redirected to ${res.headers.location}`);
        // You could follow redirects here if needed
        resolve([]);
        return;
      }

      // Handle error status codes
      if (res.statusCode !== 200) {
        console.error(`Received status code ${res.statusCode}`);
        resolve([]);
        return;
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);

          if (!jsonData.data || !jsonData.data.children) {
            console.log('No posts found or unexpected response format.');
            resolve([]);
            return;
          }

          const posts = jsonData.data.children
            .filter(child => child.kind === 't3' && child.data)
            .map(child => {
              const post = child.data;

              // Format the post data
              return {
                title: post.title,
                author: post.author,
                subreddit: post.subreddit_name_prefixed,
                text: post.selftext || '[Link post]',
                url: `https://www.reddit.com${post.permalink}`,
                external_url: post.url,
                score: post.score,
                num_comments: post.num_comments,
                created_utc: new Date(post.created_utc * 1000).toISOString(),
                is_self: post.is_self,
                platform: 'Reddit'
              };
            });

          console.log(`Found ${posts.length} Reddit posts.`);
          resolve(posts);
        } catch (error) {
          console.error('Error parsing Reddit data:', error.message);
          resolve([]);
        }
      });
    }).on('error', (error) => {
      console.error('Error fetching Reddit posts:', error.message);
      resolve([]);
    });
  });
}

/**
 * Write posts to a JSON file
 * @param {Array} posts - Array of posts
 * @param {string} outputPath - Path to write the file to
 */
function writePostsToFile(posts, outputPath) {
  try {
    // Ensure the directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the posts to the file
    fs.writeFileSync(outputPath, JSON.stringify(posts, null, 2));
    console.log(`Reddit posts saved to: ${outputPath}`);
  } catch (error) {
    console.error('Error writing to file:', error.message);
    throw error;
  }
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    const { query, max, output, subreddit, sort, time } = argv;

    // Fetch Reddit posts
    const posts = await fetchRedditPosts({
      query,
      max,
      subreddit,
      sort,
      time
    });

    if (posts.length === 0) {
      console.log('No Reddit posts found for the given query.');
      process.exit(0);
    }

    // Write posts to file
    writePostsToFile(posts, output);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
