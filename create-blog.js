#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Groq } = require('groq-sdk');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const https = require('https');

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
    default: './blog-post.md'
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
  .help()
  .alias('help', 'h')
  .argv;

/**
 * Fetch news articles from Bing News Search
 * @param {string} topic - The topic to search for
 * @param {number} count - Number of articles to fetch
 * @returns {Promise<Array>} - Array of news article summaries
 */
async function fetchNewsArticles(topic, count = 3) {
  return new Promise((resolve, reject) => {
    // If count is 0, skip fetching news
    if (count <= 0) {
      console.log('Skipping news article fetching as requested.');
      return resolve([]);
    }

    const maxCount = Math.min(count, 5);  // Limit to 5 articles max
    const encodedTopic = encodeURIComponent(topic);
    const url = `https://www.bing.com/news/search?q=${encodedTopic}&format=rss`;

    console.log(`Fetching ${maxCount} news articles about "${topic}"...`);

    https.get(url, (res) => {
      let data = '';

      // Check for redirect or error status codes
      if (res.statusCode >= 300) {
        console.warn(`Received status code ${res.statusCode} when fetching news. Continuing without news articles.`);
        return resolve([]);
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          // Extract article titles and descriptions from the RSS feed
          const articles = [];
          const titleRegex = /<title>(.+?)<\/title>/g;
          const descRegex = /<description>(.+?)<\/description>/g;
          const linkRegex = /<link>(.+?)<\/link>/g;

          let titleMatch;
          let descMatch;
          let linkMatch;
          let count = 0;

          // Skip the first title match as it's usually the feed title
          titleRegex.exec(data);

          while ((titleMatch = titleRegex.exec(data)) !== null &&
            (descMatch = descRegex.exec(data)) !== null &&
            (linkMatch = linkRegex.exec(data)) !== null &&
            count < maxCount) {

            const title = titleMatch[1].replace(/&lt;.*?&gt;|<.*?>/g, '').trim();
            let desc = descMatch[1].replace(/&lt;.*?&gt;|<.*?>/g, '').trim();
            const link = linkMatch[1].trim();

            // Skip if it's the feed description
            if (desc.includes('Search results') || title.includes('Search results')) {
              continue;
            }

            // Clean up description
            desc = desc.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

            articles.push({
              title,
              description: desc,
              link
            });

            count++;
          }

          if (articles.length === 0) {
            console.log('No relevant news articles found. Generating blog post without news context.');
          }
          else {
            console.log(`Found ${articles.length} relevant news articles:`);
            articles.forEach((article, i) => {
              console.log(`  ${i + 1}. ${article.title}`);
            });
          }

          resolve(articles);
        } catch (error) {
          console.error('Error parsing news data:', error.message);
          console.log('Continuing without news articles.');
          resolve([]);  // Return empty array on error
        }
      });
    }).on('error', (error) => {
      console.error('Error fetching news:', error.message);
      console.log('Continuing without news articles.');
      resolve([]);  // Return empty array on error
    });
  });
}

/**
 * Generate blog content using Groq API
 * @param {string} topic - The topic for the blog post
 * @param {Array} newsArticles - Array of news articles
 * @param {string} model - The Groq model to use
 * @returns {Promise<string>} - The generated blog content
 */
async function generateBlogContent(topic, newsArticles, model) {
  try {
    console.log(`Generating blog post about "${topic}" using ${model}...`);

    // Create news context section if articles are available
    let newsContext = '';
    if (newsArticles && newsArticles.length > 0) {
      console.log('Incorporating news articles into the blog post...');
      newsContext = `
    Here are some recent news articles related to the topic that you should incorporate into the blog post:

    ${newsArticles.map((article, index) => `
    ARTICLE ${index + 1}:
    Title: ${article.title}
    Summary: ${article.description}
    Source: ${article.link}
    `).join('\n')}

    Please incorporate insights, facts, or perspectives from these articles into your blog post to make it current and relevant. Don't just list the articles, but weave their information naturally into your content.
    `;
    }

    const prompt = `
    Write a comprehensive, engaging, and informative blog post about "${topic}".
    ${newsContext}
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
    `;

    console.log('Sending request to Groq API...');
    const startTime = Date.now();

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: model,
    });

    const endTime = Date.now();
    const timeElapsed = (endTime - startTime) / 1000;
    console.log(`Blog post generated in ${timeElapsed.toFixed(2)} seconds.`);

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error generating blog content:', error.message);
    if (error.message.includes('API key')) {
      console.error('Please check that your GROQ_API_KEY is set correctly in the .env file.');
    }
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

    // Get file size
    const stats = fs.statSync(outputPath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log(`File size: ${fileSizeKB} KB`);

    // Count words
    const wordCount = content.split(/\s+/).length;
    console.log(`Word count: ${wordCount} words`);
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
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set in .env file');
    }

    if (process.env.GROQ_API_KEY === 'your_api_key_here') {
      throw new Error('Please replace the placeholder API key in .env file with your actual Groq API key');
    }

    const { topic, output, model, news } = argv;

    console.log('='.repeat(50));
    console.log(`ContentBot - Blog Generator`);
    console.log('='.repeat(50));
    console.log(`Topic: ${topic}`);
    console.log(`Output: ${output}`);
    console.log(`Model: ${model}`);
    console.log(`News articles: ${news}`);
    console.log('-'.repeat(50));

    // Fetch news articles
    const newsArticles = await fetchNewsArticles(topic, news);

    // Generate blog content
    const blogContent = await generateBlogContent(topic, newsArticles, model);

    // Write to markdown file
    writeToMarkdownFile(blogContent, output);

    console.log('='.repeat(50));
    console.log('Blog post generation complete!');
    console.log('='.repeat(50));
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
