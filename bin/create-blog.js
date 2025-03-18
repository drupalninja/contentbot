#!/usr/bin/env node

require('dotenv').config();
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const ContentBot = require('../lib/index');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('topic', {
    alias: 't',
    description: 'Topic for the blog post',
    type: 'string',
    demandOption: true,
  })
  .option('output', {
    alias: 'o',
    description: 'Output file path',
    type: 'string',
    default: './output/blog-post.md',
  })
  .option('model', {
    alias: 'm',
    description: 'Groq model to use',
    type: 'string',
    default: 'llama3-70b-8192',
  })
  .option('bing', {
    alias: 'b',
    description: 'Number of Bing news articles to fetch (0-5)',
    type: 'number',
    default: 5,
  })
  .option('tavily', {
    description: 'Number of Tavily search results to fetch (0-5)',
    type: 'number',
    default: 5,
  })
  .option('reddit', {
    alias: 'r',
    description: 'Number of Reddit posts to fetch (0-10)',
    type: 'number',
    default: 5,
  })
  .option('youtube', {
    alias: 'y',
    description: 'Number of YouTube videos to fetch (0-5)',
    type: 'number',
    default: 5,
  })
  .help()
  .alias('help', 'h')
  .argv;

/**
 * Main function to run the script
 */
async function main() {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set in .env file');
    }

    const contentBot = new ContentBot({
      model: argv.model,
    });

    console.log(`Generating blog post about "${argv.topic}" using ${argv.model}...`);

    // Handle scraping options (Future implementation)
    if (argv.bing > 0 || argv.tavily > 0 || argv.reddit > 0 || argv.youtube > 0) {
      console.log('Note: Scraping options are not yet implemented in the module version.');
      console.log('These will be added in a future update.');
    }

    const result = await contentBot.createBlog(argv.topic, {
      outputPath: argv.output,
      model: argv.model,
    });

    console.log(`Blog post successfully written to ${result.filePath}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
