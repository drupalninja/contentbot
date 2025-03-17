#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Groq } = require('groq-sdk');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

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
  .help()
  .alias('help', 'h')
  .argv;

/**
 * Generate blog content using Groq API
 * @param {string} topic - The topic for the blog post
 * @param {string} model - The Groq model to use
 * @returns {Promise<string>} - The generated blog content
 */
async function generateBlogContent(topic, model) {
  try {
    console.log(`Generating blog post about "${topic}" using ${model}...`);

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

    const { topic, output, model } = argv;

    // Generate blog content
    const blogContent = await generateBlogContent(topic, model);

    // Write to markdown file
    writeToMarkdownFile(blogContent, output);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
