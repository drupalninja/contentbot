#!/usr/bin/env node

require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('query', {
    alias: 'q',
    description: 'Search query for YouTube videos',
    type: 'string',
    demandOption: true
  })
  .option('max', {
    alias: 'm',
    description: 'Maximum number of videos to fetch (1-50)',
    type: 'number',
    default: 5
  })
  .option('output', {
    alias: 'o',
    description: 'Output JSON file path',
    type: 'string',
    default: './output/youtube-videos.json'
  })
  .option('order', {
    description: 'Sort order (relevance, date, rating, viewCount, title)',
    type: 'string',
    default: 'relevance',
    choices: ['relevance', 'date', 'rating', 'viewCount', 'title']
  })
  .option('type', {
    description: 'Type of video to search for',
    type: 'string',
    default: 'video',
    choices: ['video', 'channel', 'playlist']
  })
  .help()
  .alias('help', 'h')
  .argv;

/**
 * Fetch YouTube videos related to a topic
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Array of YouTube videos
 */
async function fetchYouTubeVideos(options) {
  const { query, max, order, type } = options;
  const limit = Math.min(Math.max(1, max), 50); // Limit between 1 and 50

  if (!process.env.YOUTUBE_API_KEY) {
    console.error('Error: YOUTUBE_API_KEY is not set in .env file');
    console.log('Please get an API key from https://console.cloud.google.com/apis/credentials');
    return [];
  }

  console.log(`Fetching up to ${limit} YouTube videos about "${query}"...`);

  // Build the search URL
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=${type}&order=${order}&maxResults=${limit}&key=${process.env.YOUTUBE_API_KEY}`;

  return new Promise((resolve, reject) => {
    https.get(searchUrl, (res) => {
      let data = '';

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

          if (!jsonData.items || jsonData.items.length === 0) {
            console.log('No videos found or unexpected response format.');
            resolve([]);
            return;
          }

          // Get video statistics for each video
          const videoIds = jsonData.items
            .filter(item => item.id.kind === 'youtube#video')
            .map(item => item.id.videoId)
            .join(',');

          if (videoIds) {
            const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${process.env.YOUTUBE_API_KEY}`;

            https.get(statsUrl, (statsRes) => {
              let statsData = '';

              statsRes.on('data', (chunk) => {
                statsData += chunk;
              });

              statsRes.on('end', () => {
                try {
                  const statsJson = JSON.parse(statsData);
                  const statsMap = new Map(statsJson.items.map(item => [item.id, item.statistics]));

                  const videos = jsonData.items
                    .filter(item => item.id.kind === 'youtube#video')
                    .map(item => {
                      const video = item;
                      const stats = statsMap.get(video.id.videoId) || {};

                      // Format the video data
                      return {
                        title: video.snippet.title,
                        description: video.snippet.description,
                        channelTitle: video.snippet.channelTitle,
                        publishedAt: video.snippet.publishedAt,
                        thumbnailUrl: video.snippet.thumbnails.high.url,
                        videoId: video.id.videoId,
                        url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
                        viewCount: parseInt(stats.viewCount) || 0,
                        likeCount: parseInt(stats.likeCount) || 0,
                        commentCount: parseInt(stats.commentCount) || 0,
                        platform: 'YouTube'
                      };
                    });

                  console.log(`Found ${videos.length} YouTube videos.`);
                  resolve(videos);
                } catch (error) {
                  console.error('Error parsing video statistics:', error.message);
                  resolve([]);
                }
              });
            }).on('error', (error) => {
              console.error('Error fetching video statistics:', error.message);
              resolve([]);
            });
          } else {
            resolve([]);
          }
        } catch (error) {
          console.error('Error parsing YouTube data:', error.message);
          resolve([]);
        }
      });
    }).on('error', (error) => {
      console.error('Error fetching YouTube videos:', error.message);
      resolve([]);
    });
  });
}

/**
 * Write videos to a JSON file
 * @param {Array} videos - Array of videos
 * @param {string} outputPath - Path to write the file to
 */
function writeVideosToFile(videos, outputPath) {
  try {
    // Ensure the directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the videos to the file
    fs.writeFileSync(outputPath, JSON.stringify(videos, null, 2));
    console.log(`YouTube videos saved to: ${outputPath}`);
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
    const { query, max, output, order, type } = argv;

    // Fetch YouTube videos
    const videos = await fetchYouTubeVideos({
      query,
      max,
      order,
      type
    });

    if (videos.length === 0) {
      console.log('No YouTube videos found for the given query.');
      process.exit(0);
    }

    // Write videos to file
    writeVideosToFile(videos, output);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
