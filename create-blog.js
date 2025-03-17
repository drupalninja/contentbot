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
 * Generate blog content using Groq API
 * @param {string} topic - The topic for the blog post
 * @param {Array} newsArticles - Array of news articles
 * @param {string} model - The Groq model to use
 * @returns {Promise<string>} - The generated blog content
 */
async function generateBlogContent(topic, newsArticles, model) {
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
 * Main function to run the script
 */
async function main() {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set in .env file');
    }

    const { topic, output, model, news } = argv;

    // Fetch news articles
    const newsArticles = await fetchNewsArticles(topic, news);

    // Generate blog content
    const blogContent = await generateBlogContent(topic, newsArticles, model);

    // Write to markdown file
    writeToMarkdownFile(blogContent, output);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
