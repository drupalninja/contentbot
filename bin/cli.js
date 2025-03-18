#!/usr/bin/env node

require('dotenv').config();
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const ContentBot = require('../lib/index');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .command('create-blog', 'Create a blog post', (yargs) => {
    return yargs
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
      });
  }, async (argv) => {
    try {
      const contentBot = new ContentBot({
        model: argv.model,
      });

      console.log(`Generating blog post about "${argv.topic}" using ${argv.model}...`);

      const result = await contentBot.createBlog(argv.topic, {
        outputPath: argv.output,
        model: argv.model,
      });

      console.log(`Blog post successfully written to ${result.filePath}`);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })
  .command('$0', 'Default command - show help', () => { }, (argv) => {
    yargs.showHelp();
    console.log('\nRun one of the available commands:');
    console.log('  contentbot create-blog --topic "Your Topic"');
  })
  .help()
  .alias('help', 'h')
  .argv;
