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
 * @param {string} keywords - Keywords to include in topics (comma-separated)
 * @returns {Promise<string>} - The generated topics content
 */
async function generateTopicIdeas(category, newsArticles, count, audience, model, keywords) {
  try {
    console.log(`Generating ${count} topic ideas for "${category}" category using ${model}...`);

    let newsArticlesText = '';
    if (newsArticles.length > 0) {
      newsArticlesText = `
Here are some recent news articles related to this category that you should use for inspiration:

${newsArticles.map((article, index) => `
Article ${index + 1}:
Title: ${article.title}
Description: ${article.description}
Date: ${article.pubDate}
Link: ${article.link}
`).join('\n')}

Please use these articles to identify current trends, controversies, or interesting angles for the topic ideas.
`;
    }

    let keywordsText = '';
    if (keywords) {
      const keywordsList = keywords.split(',').map(k => k.trim());
      keywordsText = `
KEYWORDS TO INCLUDE:
Try to incorporate some of these keywords into your topic ideas:
${keywordsList.map(keyword => `- "${keyword}"`).join('\n')}
`;
    }

    const prompt = `
You are a specialized AI that ONLY outputs valid, parseable JSON.

Your task is to generate ${count} unique and engaging blog topic ideas related to "${category}" for a ${audience} audience.

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
${keywordsText}

IMPORTANT:
1. Make topics specific, actionable, and based on current trends
2. Focus on unique angles and innovative approaches
3. Your response MUST only contain the JSON object - no markdown, no explanations, no extra text
4. Ensure all JSON keys and string values are properly double-quoted
5. Do not use single quotes in your JSON
6. Do not include comments in the JSON
7. Verify your response is valid JSON before returning it
`;

    // Save the prompt to a file
    savePrompt(prompt, category, argv.output);

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: model,
    });

    let content = completion.choices[0]?.message?.content || '';

    // Clean up the content - remove any non-JSON text
    const jsonMatch = content.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    // Further cleanup for common issues
    content = content.replace(/```json/g, '')
      .replace(/```/g, '')
      .replace(/\\"/g, '"')
      .replace(/\t/g, '  ')
      .trim();

    // Try to parse the content as JSON to ensure it's valid
    try {
      const jsonData = JSON.parse(content);

      // Ensure it has the expected structure
      if (!jsonData.topics) {
        console.warn('JSON is valid but missing topics array. Adding empty topics array.');
        jsonData.topics = [];
      }

      // Add metadata if missing
      if (!jsonData.category) jsonData.category = category;
      if (!jsonData.audience) jsonData.audience = audience;
      if (!jsonData.generatedAt) jsonData.generatedAt = new Date().toISOString().split('T')[0];

      return JSON.stringify(jsonData, null, 2);
    } catch (error) {
      console.error('Failed to parse JSON:', error.message);
      console.error('Creating a fallback JSON structure with the information we have.');

      // Create a fallback JSON structure
      const fallbackData = {
        category,
        audience,
        generatedAt: new Date().toISOString().split('T')[0],
        topics: [],
        rawContent: content,
        error: `Failed to parse JSON: ${error.message}`
      };

      return JSON.stringify(fallbackData, null, 2);
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

/**
 * Main function to run the script.
 */
async function main() {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set in .env file');
    }

    const { category, count, output, model, bing, tavily, audience, keywords } = argv;

    // Initialize Tavily if needed for news search
    if (tavily > 0) {
      await initTavily();
    }

    console.log('Starting research for topic ideas...');

    // Fetch news articles for inspiration
    const newsArticles = await fetchNewsArticles(category, bing, tavily);

    console.log('\nResearch completed:');
    console.log(`- News articles: ${newsArticles.length}\n`);

    // Save raw research data
    const researchData = {
      newsArticles
    };

    // Update the output path to use .json extension
    const jsonOutput = output.replace(/\.md$/, '.json');
    saveResearchData(researchData, category, jsonOutput);

    // Generate topic ideas
    const topicIdeas = await generateTopicIdeas(category, newsArticles, count, audience, model, keywords);

    // Write to JSON file
    writeToJsonFile(topicIdeas, jsonOutput);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
