#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('='.repeat(50));
console.log('ContentBot Setup');
console.log('='.repeat(50));
console.log('This script will help you set up ContentBot for generating blog posts.');
console.log('');

// Check if .env file exists
const envExists = fs.existsSync(path.join(__dirname, '.env'));

if (envExists) {
  console.log('An .env file already exists. Do you want to overwrite it? (y/n)');
  rl.question('> ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      createEnvFile();
    }
    else {
      console.log('Skipping .env file creation.');
      checkDependencies();
    }
  });
}
else {
  createEnvFile();
}

function createEnvFile() {
  rl.question('Enter your Groq API key (get one at https://console.groq.com/keys): ', (apiKey) => {
    if (!apiKey) {
      console.log('No API key provided. You can add it later to the .env file.');
      apiKey = 'your_api_key_here';
    }

    const envContent = `# Groq API Key - Get yours at https://console.groq.com/keys
GROQ_API_KEY=${apiKey}`;

    fs.writeFileSync(path.join(__dirname, '.env'), envContent);
    console.log('Created .env file with your API key.');

    checkDependencies();
  });
}

function checkDependencies() {
  console.log('Checking dependencies...');

  try {
    // Check if node_modules exists
    const nodeModulesExists = fs.existsSync(path.join(__dirname, 'node_modules'));

    if (!nodeModulesExists) {
      console.log('Installing dependencies...');
      execSync('npm install', { stdio: 'inherit' });
      console.log('Dependencies installed successfully.');
    }
    else {
      console.log('Dependencies already installed.');
    }

    // Ensure output directory exists
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log('Created output directory for blog posts.');
    }

    showUsage();
  }
  catch (error) {
    console.error('Error installing dependencies:', error.message);
    console.log('Please run "npm install" manually to install dependencies.');
    showUsage();
  }
}

function showUsage() {
  console.log('');
  console.log('='.repeat(50));
  console.log('ContentBot is ready to use!');
  console.log('='.repeat(50));
  console.log('');
  console.log('Basic usage:');
  console.log('  npm run create-blog -- --topic "Your Topic Here"');
  console.log('');
  console.log('Advanced options:');
  console.log('  node create-blog.js --topic "Your Topic" --output "./output/custom-name.md" --model "llama3-8b-8192" --news 3 --reddit 5 --subreddit "technology"');
  console.log('');
  console.log('Reddit scraping:');
  console.log('  npm run scrape-reddit -- --query "Your Search Query" --max 10 --subreddit "technology"');
  console.log('');
  console.log('For more information, see the README.md file.');
  console.log('');

  rl.question('Do you want to run a test blog generation now? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      rl.question('Enter a topic for your test blog post: ', (topic) => {
        if (!topic) {
          topic = 'Artificial Intelligence';
        }

        rl.question('Include Reddit posts in the test? (y/n): ', (includeReddit) => {
          const redditOption = includeReddit.toLowerCase() === 'y' ? '--reddit 3' : '';

          console.log(`Generating a test blog post about "${topic}"...`);
          try {
            execSync(`node create-blog.js --topic "${topic}" --output "./output/test-blog.md" --news 2 ${redditOption}`, { stdio: 'inherit' });
            console.log('');
            console.log('Test blog post generated successfully!');
            console.log('You can find it at ./output/test-blog.md');
          }
          catch (error) {
            console.error('Error generating test blog post:', error.message);
          }

          rl.close();
        });
      });
    }
    else {
      rl.close();
    }
  });
}
