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
  if (!process.env.TAVILY_API_KEY) {
    console.log('TAVILY_API_KEY is not set in .env file.');
    return false;
  }

  if (tavilyInitialized && tavilyClient) {
    return true;
  }

  try {
    const { TavilyClient } = await import('tavily');

    if (TavilyClient) {
      tavilyClient = new TavilyClient({
        apiKey: process.env.TAVILY_API_KEY,
      });
      tavilyInitialized = true;
      return true;
    }

    console.error('Failed to initialize Tavily API: TavilyClient not found');
    return false;
  } catch (error) {
    console.error('Failed to initialize Tavily API:', error.message);
    return false;
  }
}

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

          console.log(`Found ${articles.length} news articles from Bing:`);
          articles.forEach((article, index) => {
            console.log(`  ${index + 1}. ${article.title}`);
          });
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
      query: `latest trends and topics about ${topic}`,
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

      console.log(`Found ${articles.length} news articles from Tavily:`);
      articles.forEach((article, index) => {
        console.log(`  ${index + 1}. ${article.title}`);
      });
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
  if (tavilyCount > 0) {
    const tavilyInitialized = await initTavily();
    if (tavilyInitialized) {
      const tavilyArticles = await fetchTavilyNewsArticles(topic, tavilyCount);
      allArticles.push(...tavilyArticles);
      console.log(`Added ${tavilyArticles.length} articles from Tavily.`);
    } else {
      console.log('Tavily API initialization failed. To enable Tavily search, ensure TAVILY_API_KEY is correct in your .env file.');
    }
  }

  return allArticles;
}

/**
 * Save prompt to a text file
 * @param {string} prompt - The prompt sent to the model
 * @param {string} category - The topic category
 * @param {string} outputPath - The path to write the output file
 */
function savePrompt(prompt, category, outputPath) {
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
    const promptOutput = `Category: ${category}
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
 * Save research data to a JSON file
 * @param {Object} researchData - Object containing all research data
 * @param {string} category - The topic category
 * @param {string} outputPath - The path to write the research data file
 */
function saveResearchData(researchData, category, outputPath) {
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
      category,
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
 * Generate topic ideas using Groq API
 * @param {string} category - The category for topic generation
 * @param {Array} newsArticles - Array of news articles
 * @param {number} count - Number of topics to generate
 * @param {string} audience - Target audience for the topics
 * @param {string} model - The Groq model to use
 * @param {string|Array} keywords - Keywords to include in topics (comma-separated string or array)
 * @param {Object} additionalResearch - Additional research data
 * @param {string} outputPath - Optional path to save the prompt
 * @returns {Promise<string>} - The generated topics content
 */
async function generateTopicIdeas(category, newsArticles, count, audience, model, keywords, additionalResearch = {}, outputPath = null) {
  try {
    console.log(`Generating ${count} topic ideas for "${category}" category using ${model}...`);

    const { redditPosts = [], youtubeVideos = [] } = additionalResearch;

    let newsArticlesText = '';
    if (newsArticles.length > 0) {
      newsArticlesText = `
Here are some recent news articles related to this category that you should use for inspiration:

${newsArticles.map((article, index) => `
Article ${index + 1}:
Title: ${article.title}
Description: ${article.description}
Date: ${article.pubDate || 'Recent'}
Link: ${article.link}
`).join('\n')}

Please use these articles to identify current trends, controversies, or interesting angles for the topic ideas.
`;
    }

    let redditPostsText = '';
    if (redditPosts.length > 0) {
      redditPostsText = `
Here are some recent Reddit discussions related to this category:

${redditPosts.map((post, index) => `
Reddit Post ${index + 1}:
Title: ${post.title}
Subreddit: r/${post.subreddit}
Author: u/${post.author}
Upvotes: ${post.upvotes}
Comments: ${post.commentCount || 'Multiple'}
URL: ${post.url}
${post.content ? `Content snippet: ${post.content.substring(0, 200)}...` : ''}
`).join('\n')}

Please use these Reddit discussions to identify what real people are currently talking about related to this topic.
`;
    }

    let youtubeVideosText = '';
    if (youtubeVideos.length > 0) {
      youtubeVideosText = `
Here are some recent YouTube videos related to this category:

${youtubeVideos.map((video, index) => `
YouTube Video ${index + 1}:
Title: ${video.title}
Channel: ${video.channelTitle}
Published: ${video.publishedAt || 'Recently'}
Views: ${video.viewCount?.toLocaleString() || 'Multiple'}
URL: ${video.url}
${video.description ? `Description snippet: ${video.description.substring(0, 200)}...` : ''}
`).join('\n')}

Please use these YouTube videos to identify current trends, popular content formats, and discussion topics.
`;
    }

    let keywordsText = '';
    if (keywords) {
      // Convert keywords to string if it's an array
      const keywordsStr = Array.isArray(keywords) ? keywords.join(',') : String(keywords || '');

      // Only process if we have a non-empty string
      if (keywordsStr.trim()) {
        const keywordsList = keywordsStr.split(',').map(k => k.trim());
        keywordsText = `
KEYWORDS TO INCLUDE:
Try to incorporate some of these keywords into your topic ideas:
${keywordsList.map(keyword => `- "${keyword}"`).join('\n')}
`;
      }
    }

    const prompt = `
You are a specialized AI that ONLY outputs valid, parseable JSON.

Your task is to generate ${count} unique and engaging blog topic ideas related to "${category}" for a ${audience} audience.
Your topic ideas MUST be based on the CURRENT and UP-TO-DATE information I've provided about this subject.

VERY IMPORTANT: Only include factually accurate and up-to-date information in your topics. For specialized subjects (like sports teams, companies, or technology), make sure any specific entities you mention (e.g., players, products, executives) are actually current and relevant. If you're unsure about specific details, focus on broader concepts instead.

For each topic idea, include:
- A catchy, SEO-friendly title
- A 2-3 sentence summary explaining what the blog post would cover
- 3-5 key points that would be addressed
- A suggested primary keyword for SEO
- Explanation of why this topic is valuable to the target audience

The output MUST be valid JSON with this exact structure:
{
  "category": "${category}",
  "audience": "${audience}",
  "generatedAt": "${new Date().toISOString().split('T')[0]}",
  "topics": [
    {
      "title": "Example Title",
      "summary": "Example summary.",
      "keyPoints": ["Point 1", "Point 2", "Point 3"],
      "targetKeyword": "keyword",
      "valueProposition": "Why it's valuable."
    }
  ]
}

${newsArticlesText}
${redditPostsText}
${youtubeVideosText}
${keywordsText}

IMPORTANT:
1. Make topics CURRENT and UP-TO-DATE - avoid suggesting outdated information
2. Check the accuracy of specific entities mentioned (people, products, teams, etc.)
3. Make topics specific, actionable, and based on current trends
4. Focus on unique angles and innovative approaches
5. Your response MUST only contain the JSON object - no markdown, no explanations, no extra text
6. Ensure all JSON keys and string values are properly double-quoted
7. Do not use single quotes in your JSON
8. Do not include comments in the JSON
9. Verify your response is valid JSON before returning it
`;

    // Save the prompt to a file if outputPath is provided
    if (outputPath) {
      savePrompt(prompt, category, outputPath);
    }

    // Generate completion with Groq
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: model,
    });

    // Get the response content
    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from Groq API');
    }

    // Try to parse JSON from the response
    try {
      // Basic validation to ensure we have valid JSON
      const jsonData = JSON.parse(content);

      // Ensure the expected structure is present
      if (!jsonData.topics) jsonData.topics = [];
      if (!jsonData.category) jsonData.category = category;
      if (!jsonData.audience) jsonData.audience = audience;
      if (!jsonData.generatedAt) jsonData.generatedAt = new Date().toISOString().split('T')[0];

      // Add additional research data
      jsonData.additionalResearch = additionalResearch;

      return JSON.stringify(jsonData, null, 2);
    } catch (error) {
      console.error('Error parsing JSON from API response:', error.message);
      console.log('Raw content received:', content);

      // Try to fix common JSON formatting errors - this is simplistic but handles some cases
      let fixedContent = content;

      // Case 1: Fix "styleTypeKeyword" to "targetKeyword" - spotted in the error
      fixedContent = fixedContent.replace(/styleTypeKeyword":/g, 'targetKeyword":');

      // Case 2: Fix other common errors
      fixedContent = fixedContent.replace(/([,{]\s*)(\w+)(\s*:)/g, '$1"$2"$3'); // Add quotes to unquoted property keys

      // Try parsing again
      try {
        const jsonData = JSON.parse(fixedContent);

        // Ensure the expected structure is present
        if (!jsonData.topics) jsonData.topics = [];
        if (!jsonData.category) jsonData.category = category;
        if (!jsonData.audience) jsonData.audience = audience;
        if (!jsonData.generatedAt) jsonData.generatedAt = new Date().toISOString().split('T')[0];

        // Add additional research data
        jsonData.additionalResearch = additionalResearch;

        console.log('Successfully fixed and parsed the JSON response!');
        return JSON.stringify(jsonData, null, 2);
      } catch (secondError) {
        // If we still couldn't parse it, return the fallback with the error information
        console.error('Failed to fix JSON:', secondError.message);

        // Return a fallback JSON with error information
        return JSON.stringify({
          category,
          audience,
          generatedAt: new Date().toISOString().split('T')[0],
          topics: [],
          rawContent: content,
          error: `Failed to parse JSON: ${error.message}`,
          additionalResearch: additionalResearch
        }, null, 2);
      }
    }
  } catch (error) {
    console.error('Error generating topic ideas:', error.message);
    throw error;
  }
}

/**
 * Write content to a JSON file
 * @param {string} content - The content to write
 * @param {string} outputPath - The path to write the file to
 */
function writeToJsonFile(content, outputPath) {
  try {
    // Ensure the directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // If the content is already valid JSON, format it nicely
    try {
      const jsonContent = JSON.parse(content);
      content = JSON.stringify(jsonContent, null, 2);
    } catch (error) {
      // If it's not valid JSON, just write it as is
      console.warn('Warning: Content is not valid JSON, writing as plain text.');
    }

    // Update the file extension to .json
    outputPath = outputPath.replace(/\.md$/, '.json');

    // Write the content to the file
    fs.writeFileSync(outputPath, content);
    console.log(`Topic ideas successfully written to ${outputPath}`);
  } catch (error) {
    console.error('Error writing to file:', error.message);
    throw error;
  }
}

// Main function to generate topics
async function generateTopics(category, count = 5, audience = 'general', outputPath = './output/topics.json', model = 'llama3-70b-8192', keywords = [],
  options = { bingCount: 5, tavilyCount: 5, researchMode: 'enhanced' }) {
  try {
    // Create output directory if it doesn't exist and outputPath is provided
    if (outputPath) {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    }

    console.log(`Generating ${count} topic ideas for ${category} targeting ${audience}...`);

    // Get default or passed option values
    const bingCount = options.bingCount || 5;
    const tavilyCount = options.tavilyCount || 5;
    const researchMode = options.researchMode || 'enhanced';

    console.log(`Using research mode: ${researchMode}`);
    console.log(`Fetching news articles: ${bingCount} from Bing, ${tavilyCount} from Tavily`);

    // Fetch news articles for research
    const newsArticles = await fetchNewsArticles(category, bingCount, tavilyCount);

    // Try to import additional research modules if in enhanced mode
    let redditPosts = [];
    let youtubeVideos = [];

    if (researchMode === 'enhanced') {
      try {
        // Try to load the Reddit scraping function
        const redditModule = require('./scrape-reddit');
        if (redditModule && redditModule.fetchRedditPosts) {
          console.log(`Fetching Reddit posts for ${category}...`);
          redditPosts = await redditModule.fetchRedditPosts(category, 3);
          console.log(`Fetched ${redditPosts.length} Reddit posts`);
        }
      } catch (error) {
        console.log(`Reddit research not available: ${error.message}`);
      }

      try {
        // Try to load the YouTube scraping function
        const youtubeModule = require('./scrape-youtube');
        if (youtubeModule && youtubeModule.fetchYouTubeVideos) {
          console.log(`Fetching YouTube videos for ${category}...`);
          youtubeVideos = await youtubeModule.fetchYouTubeVideos(category, 3);
          console.log(`Fetched ${youtubeVideos.length} YouTube videos`);
        }
      } catch (error) {
        console.log(`YouTube research not available: ${error.message}`);
      }
    }

    // Combine all research data
    const researchData = {
      newsArticles,
      redditPosts,
      youtubeVideos
    };

    // Save research data if outputPath is provided
    if (outputPath) {
      saveResearchData(researchData, category, outputPath);
    }

    // Generate topic ideas with enhanced research
    const topicIdeas = await generateTopicIdeas(
      category,
      newsArticles,
      count,
      audience,
      model,
      keywords,
      { redditPosts, youtubeVideos },
      outputPath
    );

    // Parse the JSON string to get the object
    const topicsObject = JSON.parse(topicIdeas);

    // Save the results to file if outputPath is provided
    if (outputPath) {
      writeToJsonFile(topicIdeas, outputPath);
      console.log(`✅ Generated ${topicsObject.topics.length} topic ideas and saved to ${outputPath}`);
    } else {
      console.log(`✅ Generated ${topicsObject.topics.length} topic ideas`);
    }

    // Return the parsed object instead of the JSON string
    return topicsObject;
  } catch (error) {
    console.error('Error generating topics:', error);
    throw error;
  }
}

// Command line interface handler
async function main() {
  // Only parse command line arguments when running as CLI
  if (require.main === module) {
    const argv = yargs(hideBin(process.argv))
      .option('category', {
        alias: 'c',
        description: 'Category for topic generation (e.g., technology, health, finance)',
        type: 'string',
        demandOption: true
      })
      .option('count', {
        alias: 'n',
        description: 'Number of topics to generate',
        type: 'number',
        default: 5
      })
      .option('output', {
        alias: 'o',
        description: 'Output file path',
        type: 'string',
        default: './output/topic-ideas.json'
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
        default: 3
      })
      .option('tavily', {
        description: 'Number of Tavily search results to fetch (0-5)',
        type: 'number',
        default: 3
      })
      .option('audience', {
        alias: 'a',
        description: 'Target audience for the topics (e.g., beginners, professionals, general)',
        type: 'string',
        default: 'general'
      })
      .option('keywords', {
        alias: 'k',
        description: 'Keywords to include in topics (comma-separated)',
        type: 'string'
      })
      .help()
      .alias('help', 'h')
      .argv;

    try {
      await generateTopics(
        argv.category,
        argv.count,
        argv.audience,
        argv.output,
        argv.model,
        argv.keywords,
        {
          bingCount: argv.bing,
          tavilyCount: argv.tavily,
          researchMode: 'enhanced'
        }
      );
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }
}

// Run the main function if this script is executed directly
if (require.main === module) {
  main();
}

// Export functions for programmatic use
module.exports = {
  generateTopics,
  fetchNewsArticles,
  generateTopicIdeas,
  writeToJsonFile,
};
