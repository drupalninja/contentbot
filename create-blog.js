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

// Initialize Tavily client if API key is available
let tavilyInitialized = false;
let tavilyClient = null;

// Function to initialize Tavily
async function initTavily() {
  if (!process.env.TAVILY_API_KEY || tavilyInitialized) {
    return;
  }

  try {
    const tavilyModule = await import('tavily');

    // Based on the output, we know the module has TavilyClient and tavily properties
    if (tavilyModule.TavilyClient) {
      tavilyClient = new tavilyModule.TavilyClient({
        apiKey: process.env.TAVILY_API_KEY,
      });
      tavilyInitialized = true;
      console.log('Tavily API initialized successfully (TavilyClient).');
    } else if (tavilyModule.tavily) {
      tavilyClient = new tavilyModule.tavily({
        apiKey: process.env.TAVILY_API_KEY,
      });
      tavilyInitialized = true;
      console.log('Tavily API initialized successfully (tavily).');
    } else if (tavilyModule.default) {
      tavilyClient = new tavilyModule.default({
        apiKey: process.env.TAVILY_API_KEY,
      });
      tavilyInitialized = true;
      console.log('Tavily API initialized successfully (default).');
    } else {
      console.error('Failed to initialize Tavily API: Unsupported module structure', Object.keys(tavilyModule));
    }
  } catch (error) {
    console.error('Failed to initialize Tavily API:', error.message);
  }
}

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
  .option('bing', {
    alias: 'b',
    description: 'Number of Bing news articles to fetch (0-5)',
    type: 'number',
    default: 5
  })
  .option('tavily', {
    description: 'Number of Tavily search results to fetch (0-5)',
    type: 'number',
    default: 5
  })
  .option('reddit', {
    alias: 'r',
    description: 'Number of Reddit posts to fetch (0-10)',
    type: 'number',
    default: 5
  })
  .option('youtube', {
    alias: 'y',
    description: 'Number of YouTube videos to fetch (0-5)',
    type: 'number',
    default: 5
  })
  .option('subreddit', {
    alias: 's',
    description: 'Specific subreddit to search in (optional)',
    type: 'string'
  })
  .option('keywords', {
    alias: 'k',
    description: 'SEO keywords to target (comma-separated)',
    type: 'string'
  })
  .help()
  .alias('help', 'h')
  .argv;

/**
 * Fetch news articles related to a topic using Bing News
 * @param {string} topic - The topic to search for
 * @param {number} count - Number of articles to fetch
 * @returns {Promise<Array>} - Array of news articles
 */
async function fetchBingNewsArticles(topic, count = 3) {
  if (count <= 0) {
    return [];
  }

  count = Math.min(count, 5); // Limit to 5 articles max
  console.log(`Fetching ${count} news articles from Bing about "${topic}"...`);

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
              pubDate,
              source: 'Bing News'
            });
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

/**
 * Fetch news articles related to a topic using Tavily
 * @param {string} topic - The topic to search for
 * @param {number} count - Number of articles to fetch
 * @returns {Promise<Array>} - Array of news articles
 */
async function fetchTavilyNewsArticles(topic, count = 3) {
  if (count <= 0 || !tavilyClient) {
    return [];
  }

  count = Math.min(count, 5); // Limit to 5 articles max
  console.log(`Fetching ${count} news articles from Tavily about "${topic}"...`);

  try {
    const response = await tavilyClient.search({
      query: `latest news about ${topic}`,
      search_depth: "advanced",
      include_domains: ["news.google.com", "cnn.com", "bbc.com", "reuters.com", "bloomberg.com", "nytimes.com", "wsj.com", "theguardian.com", "apnews.com", "npr.org"],
      max_results: count,
      include_answer: false,
      include_raw_content: false,
    });

    if (response && response.results && response.results.length > 0) {
      const articles = response.results.map(result => ({
        title: result.title || 'No title available',
        link: result.url,
        description: result.content || result.snippet || 'No description available',
        pubDate: new Date().toISOString(), // Tavily doesn't provide dates, use current date
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

/**
 * Fetch news articles related to a topic using multiple sources
 * @param {string} topic - The topic to search for
 * @param {number} bingCount - Number of Bing news articles to fetch
 * @param {number} tavilyCount - Number of Tavily search results to fetch
 * @returns {Promise<Array>} - Array of news articles
 */
async function fetchNewsArticles(topic, bingCount = 3, tavilyCount = 0) {
  const allArticles = [];

  // Fetch from Bing if requested
  if (bingCount > 0) {
    const bingArticles = await fetchBingNewsArticles(topic, bingCount);
    allArticles.push(...bingArticles);
    console.log(`Added ${bingArticles.length} articles from Bing.`);
  }

  // Fetch from Tavily if requested and available
  if (tavilyCount > 0 && tavilyClient) {
    const tavilyArticles = await fetchTavilyNewsArticles(topic, tavilyCount);
    allArticles.push(...tavilyArticles);
    console.log(`Added ${tavilyArticles.length} articles from Tavily.`);
  } else if (tavilyCount > 0 && !tavilyClient) {
    console.log('Tavily API is not available. To enable Tavily search, add TAVILY_API_KEY to your .env file.');
  }

  return allArticles;
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
 * Save prompt to a text file
 * @param {string} prompt - The prompt sent to the model
 * @param {string} topic - The research topic
 * @param {string} outputPath - The path to write the blog post file
 */
function savePrompt(prompt, topic, outputPath) {
  try {
    // Create prompts directory path
    const promptsDir = path.join(path.dirname(outputPath), 'prompts');

    // Create the prompts directory if it doesn't exist
    if (!fs.existsSync(promptsDir)) {
      fs.mkdirSync(promptsDir, { recursive: true });
    }

    // Get the base filename from the output path and create prompt filename
    const baseFilename = path.basename(outputPath, '.md');
    const promptFilename = `${baseFilename}-prompt.txt`;
    const promptOutputPath = path.join(promptsDir, promptFilename);

    // Add metadata to the prompt
    const promptOutput = `Topic: ${topic}
Timestamp: ${new Date().toISOString()}

${prompt}`;

    // Write the prompt to the file
    fs.writeFileSync(promptOutputPath, promptOutput);
    console.log(`Prompt saved to ${promptOutputPath}`);
  } catch (error) {
    console.error('Error saving prompt:', error.message);
    throw error;
  }
}

/**
 * Generate blog content using Groq API
 * @param {string} topic - The topic for the blog post
 * @param {Array} newsArticles - Array of news articles
 * @param {Array} redditPosts - Array of Reddit posts
 * @param {Array} youtubeVideos - Array of YouTube videos
 * @param {string} model - The Groq model to use
 * @param {string} keywords - SEO keywords to target (comma-separated)
 * @returns {Promise<string>} - The generated blog content
 */
async function generateBlogContent(topic, newsArticles, redditPosts, youtubeVideos, model, keywords) {
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

    let seoInstructionsText = '';
    if (keywords) {
      const keywordsList = keywords.split(',').map(k => k.trim());
      seoInstructionsText = `
SEO INSTRUCTIONS:
Target the following keywords in your blog post:
${keywordsList.map(keyword => `- "${keyword}"`).join('\n')}

SEO guidelines:
- Include the primary keyword (the first one in the list) in the title, first paragraph, and at least one heading
- Use secondary keywords (the rest in the list) naturally throughout the content
- Include keywords in image alt text suggestions if you reference images
- Ensure keyword density is natural and not forced (around 1-2% of total word count)
- Use variations and synonyms of the keywords where appropriate
- Structure content with proper heading hierarchy (H1, H2, H3) that includes keywords
- DO NOT include a "Meta Description" section in the content - the description in the front matter will be used for this purpose
- DO NOT include a "Keywords" section at the end of the content - the tags in the front matter will be used for this purpose
`;
    }

    const prompt = `
Write a comprehensive, engaging, and informative blog post about "${topic}".

IMPORTANT: Start the blog post with YAML front matter at the very beginning of the document. There should be no text before the front matter. The front matter should look like this:

---
title: "Your catchy title here"
date: ${new Date().toISOString().split('T')[0]}
description: "A brief description of the blog post that includes the primary keyword (this will be used as the meta description)"
tags: [${keywords ? keywords.split(',').map(k => `"${k.trim()}"`).join(', ') : ''}]
author: "AI Content Generator"
---

After the front matter, the blog post should:
- Have a catchy title (H1 heading)
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

IMPORTANT: DO NOT include a "Meta Description" or "Keywords" section at the end of the blog post. This information should ONLY be in the front matter.

The blog post should be between 800-1200 words.
${newsArticlesText}
${redditPostsText}
${youtubeVideosText}
${seoInstructionsText}
`;

    // Save the prompt to a file
    savePrompt(prompt, topic, argv.output);

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
 * Save raw research data to a JSON file
 * @param {Object} researchData - Object containing all research data
 * @param {string} topic - The research topic
 * @param {string} outputPath - The path to write the research data file
 */
function saveResearchData(researchData, topic, outputPath) {
  try {
    // Create research directory path
    const researchDir = path.join(path.dirname(outputPath), 'research');

    // Create the research directory if it doesn't exist
    if (!fs.existsSync(researchDir)) {
      fs.mkdirSync(researchDir, { recursive: true });
    }

    // Get the base filename from the output path and create research filename
    const baseFilename = path.basename(outputPath, '.md');
    const researchFilename = `${baseFilename}-research.json`;
    const researchOutputPath = path.join(researchDir, researchFilename);

    // Add metadata to the research data
    const researchOutput = {
      topic,
      timestamp: new Date().toISOString(),
      ...researchData
    };

    // Write the research data to the file
    fs.writeFileSync(researchOutputPath, JSON.stringify(researchOutput, null, 2));
    console.log(`Raw research data saved to ${researchOutputPath}`);
  } catch (error) {
    console.error('Error saving research data:', error.message);
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

    const { topic, output, model, bing, tavily, reddit, youtube, subreddit, keywords } = argv;

    // Initialize Tavily if needed for news search
    if (tavily > 0) {
      await initTavily();
    }

    console.log('Starting research tasks in parallel...');

    // Run all research tasks in parallel
    const [newsArticles, redditPosts, youtubeVideos] = await Promise.all([
      // Fetch news articles if requested (either Bing or Tavily or both)
      (bing > 0 || tavily > 0) ? fetchNewsArticles(topic, bing, tavily) : Promise.resolve([]),

      // Fetch Reddit posts if requested
      reddit > 0 ? fetchRedditPosts(topic, reddit, subreddit) : Promise.resolve([]),

      // Fetch YouTube videos if requested
      youtube > 0 ? fetchYouTubeVideos(topic, youtube) : Promise.resolve([]),
    ]);

    console.log('\nResearch completed:');
    console.log(`- News articles: ${newsArticles.length}`);
    console.log(`- Reddit posts: ${redditPosts.length}`);
    console.log(`- YouTube videos: ${youtubeVideos.length}\n`);

    // Save raw research data
    const researchData = {
      newsArticles,
      redditPosts,
      youtubeVideos
    };
    saveResearchData(researchData, topic, output);

    // Generate blog content
    const blogContent = await generateBlogContent(topic, newsArticles, redditPosts, youtubeVideos, model, keywords);

    // Write to markdown file
    writeToMarkdownFile(blogContent, output);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
