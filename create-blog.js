#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Groq } = require('groq-sdk');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const https = require('https');
const { execSync } = require('child_process');

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('topic', {
    alias: 't',
    description: 'Topic for the blog post',
    type: 'string',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    description: 'Output file path',
    type: 'string',
    default: './output/blog-post.md'
  })
  .option('model', {
    alias: 'm',
    description: 'Groq model to use',
    type: 'string',
    default: 'llama3-70b-8192'
  })
  .option('news', {
    alias: 'n',
    description: 'Number of news articles to fetch (0-5)',
    type: 'number',
    default: 3
  })
  .option('reddit', {
    alias: 'r',
    description: 'Number of Reddit posts to fetch (0-10)',
    type: 'number',
    default: 0
  })
  .option('youtube', {
    alias: 'y',
    description: 'Number of YouTube videos to fetch (0-5)',
    type: 'number',
    default: 0
  })
  .option('subreddit', {
    alias: 's',
    description: 'Specific subreddit to search in (optional)',
    type: 'string'
  })
  .help()
  .alias('help', 'h')
  .argv;

/**
 * Fetch news articles related to a topic
 * @param {string} topic - The topic to search for
 * @param {number} count - Number of articles to fetch
 * @returns {Promise<Array>} - Array of news articles
 */
async function fetchNewsArticles(topic, count = 3) {
  if (count <= 0) {
    return [];
  }

  count = Math.min(count, 5); // Limit to 5 articles max
  console.log(`Fetching ${count} news articles about "${topic}"...`);

  return new Promise((resolve, reject) => {
    const encodedTopic = encodeURIComponent(topic);
    const url = `https://www.bing.com/news/search?q=${encodedTopic}&format=rss`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          // Extract articles from RSS feed
          const articles = [];
          const regex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<description>(.*?)<\/description>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g;

          let match;
          while ((match = regex.exec(data)) !== null && articles.length < count) {
            const title = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
            const link = match[2];
            const description = match[3].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<.*?>/g, '');
            const pubDate = match[4];

            articles.push({
              title,
              link,
              description,
              pubDate
            });
          }

          console.log(`Found ${articles.length} news articles.`);
          resolve(articles);
        } catch (error) {
          console.error('Error parsing news articles:', error.message);
          resolve([]); // Return empty array on error
        }
      });
    }).on('error', (error) => {
      console.error('Error fetching news articles:', error.message);
      resolve([]); // Return empty array on error
    });
  });
}

/**
 * Fetch Reddit posts using the scrape-reddit.js script
 * @param {string} topic - The topic to search for
 * @param {number} count - Number of posts to fetch
 * @param {string} subreddit - Specific subreddit to search in (optional)
 * @returns {Promise<Array>} - Array of Reddit posts
 */
async function fetchRedditPosts(topic, count = 0, subreddit = null) {
  if (count <= 0) {
    return [];
  }

  try {
    console.log(`Fetching ${count} Reddit posts about "${topic}"...`);

    // Create a temporary file to store the posts
    const tempFile = path.join(__dirname, 'temp-reddit-posts.json');

    // Build the command
    let command = `node scrape-reddit.js --query "${topic}" --max ${count} --output "${tempFile}"`;

    // Add subreddit if specified
    if (subreddit) {
      command += ` --subreddit "${subreddit}"`;
    }

    // Run the scrape-reddit.js script
    execSync(command, {
      stdio: 'inherit'
    });

    // Check if the file exists
    if (!fs.existsSync(tempFile)) {
      console.log('No Reddit posts were scraped. Continuing without Reddit posts.');
      return [];
    }

    // Read the posts from the file
    const postsData = fs.readFileSync(tempFile, 'utf8');
    const posts = JSON.parse(postsData);

    // Delete the temporary file
    fs.unlinkSync(tempFile);

    if (posts.length === 0) {
      console.log('No Reddit posts were found. Continuing without Reddit posts.');
      return [];
    }

    console.log(`Successfully fetched ${posts.length} Reddit posts.`);
    return posts;
  } catch (error) {
    console.error('Error fetching Reddit posts:', error.message);
    console.log('Continuing without Reddit posts.');
    return [];
  }
}

/**
 * Fetch YouTube videos using the scrape-youtube.js script
 * @param {string} topic - The topic to search for
 * @param {number} count - Number of videos to fetch
 * @returns {Promise<Array>} - Array of YouTube videos
 */
async function fetchYouTubeVideos(topic, count = 0) {
  if (count <= 0) {
    return [];
  }

  try {
    console.log(`Fetching ${count} YouTube videos about "${topic}"...`);

    // Create a temporary file to store the videos
    const tempFile = path.join(__dirname, 'temp-youtube-videos.json');

    // Build the command
    const command = `node scrape-youtube.js --query "${topic}" --max ${count} --output "${tempFile}"`;

    // Run the scrape-youtube.js script
    execSync(command, {
      stdio: 'inherit'
    });

    // Check if the file exists
    if (!fs.existsSync(tempFile)) {
      console.log('No YouTube videos were scraped. Continuing without YouTube videos.');
      return [];
    }

    // Read the videos from the file
    const videosData = fs.readFileSync(tempFile, 'utf8');
    const videos = JSON.parse(videosData);

    // Delete the temporary file
    fs.unlinkSync(tempFile);

    if (videos.length === 0) {
      console.log('No YouTube videos were found. Continuing without YouTube videos.');
      return [];
    }

    console.log(`Successfully fetched ${videos.length} YouTube videos.`);
    return videos;
  } catch (error) {
    console.error('Error fetching YouTube videos:', error.message);
    console.log('Continuing without YouTube videos.');
    return [];
  }
}

/**
 * Generate blog content using Groq API
 * @param {string} topic - The topic for the blog post
 * @param {Array} newsArticles - Array of news articles
 * @param {Array} redditPosts - Array of Reddit posts
 * @param {Array} youtubeVideos - Array of YouTube videos
 * @param {string} model - The Groq model to use
 * @returns {Promise<string>} - The generated blog content
 */
async function generateBlogContent(topic, newsArticles, redditPosts, youtubeVideos, model) {
  try {
    console.log(`Generating blog post about "${topic}" using ${model}...`);

    let newsArticlesText = '';
    if (newsArticles.length > 0) {
      newsArticlesText = `
Here are some recent news articles related to this topic that you should incorporate into the blog post:

${newsArticles.map((article, index) => `
Article ${index + 1}:
Title: ${article.title}
Description: ${article.description}
Date: ${article.pubDate}
Link: ${article.link}
`).join('\n')}

Please incorporate insights, facts, or perspectives from these articles into your blog post, citing them where appropriate.
`;
    }

    let redditPostsText = '';
    if (redditPosts.length > 0) {
      redditPostsText = `
Here are some recent Reddit posts related to this topic that you should incorporate into the blog post:

${redditPosts.map((post, index) => `
Reddit Post ${index + 1}:
Title: ${post.title}
Author: ${post.author}
Subreddit: ${post.subreddit}
Content: ${post.text.substring(0, 500)}${post.text.length > 500 ? '...' : ''}
Score: ${post.score} upvotes
Comments: ${post.num_comments}
Date: ${post.created_utc}
URL: ${post.url}
`).join('\n')}

Please incorporate insights, perspectives, or discussions from these Reddit posts into your blog post to make it more engaging and connected to current conversations. You can quote these posts directly (with attribution) or summarize the key points. Don't just list the posts, but integrate them naturally into your content.
`;
    }

    let youtubeVideosText = '';
    if (youtubeVideos.length > 0) {
      youtubeVideosText = `
Here are some relevant YouTube videos related to this topic that you should incorporate into the blog post:

${youtubeVideos.map((video, index) => `
YouTube Video ${index + 1}:
Title: ${video.title}
Channel: ${video.channelTitle}
Description: ${video.description.substring(0, 500)}${video.description.length > 500 ? '...' : ''}
Views: ${video.viewCount.toLocaleString()}
Likes: ${video.likeCount.toLocaleString()}
Comments: ${video.commentCount.toLocaleString()}
Date: ${video.publishedAt}
URL: ${video.url}
`).join('\n')}

Please incorporate insights, perspectives, or discussions from these YouTube videos into your blog post. You can reference specific points from the videos or summarize key takeaways. Don't just list the videos, but integrate them naturally into your content.
`;
    }

    const prompt = `
Write a comprehensive, engaging, and informative blog post about "${topic}".

The blog post should:
- Have a catchy title
- Include an introduction that hooks the reader
- Contain at least 3-5 main sections with appropriate headings
- Include relevant facts, examples, and insights
- End with a conclusion and call to action
- Be written in a conversational yet professional tone
- Be formatted in Markdown

Format the blog post with proper Markdown syntax including:
- # for the main title
- ## for section headings
- ### for sub-section headings
- **bold** for emphasis
- *italic* for secondary emphasis
- > for blockquotes
- - for bullet points
- 1. for numbered lists

The blog post should be between 800-1200 words.
${newsArticlesText}
${redditPostsText}
${youtubeVideosText}
`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: model,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error generating blog content:', error.message);
    throw error;
  }
}

/**
 * Write content to a markdown file
 * @param {string} content - The content to write
 * @param {string} outputPath - The path to write the file to
 */
function writeToMarkdownFile(content, outputPath) {
  try {
    // Ensure the directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the content to the file
    fs.writeFileSync(outputPath, content);
    console.log(`Blog post successfully written to ${outputPath}`);
  } catch (error) {
    console.error('Error writing to file:', error.message);
    throw error;
  }
}

/**
 * Main function to run the script.
 */
async function main() {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set in .env file');
    }

    const { topic, output, model, news, reddit, youtube, subreddit } = argv;

    console.log('Starting research tasks in parallel...');

    // Run all research tasks in parallel
    const [newsArticles, redditPosts, youtubeVideos] = await Promise.all([
      // Fetch news articles if requested
      news > 0 ? fetchNewsArticles(topic, news) : Promise.resolve([]),

      // Fetch Reddit posts if requested
      reddit > 0 ? fetchRedditPosts(topic, reddit, subreddit) : Promise.resolve([]),

      // Fetch YouTube videos if requested
      youtube > 0 ? fetchYouTubeVideos(topic, youtube) : Promise.resolve([]),
    ]);

    console.log('\nResearch completed:');
    console.log(`- News articles: ${newsArticles.length}`);
    console.log(`- Reddit posts: ${redditPosts.length}`);
    console.log(`- YouTube videos: ${youtubeVideos.length}\n`);

    // Generate blog content
    const blogContent = await generateBlogContent(topic, newsArticles, redditPosts, youtubeVideos, model);

    // Write to markdown file
    writeToMarkdownFile(blogContent, output);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
