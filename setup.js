#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// API key flags
let groqKeySet = false;
let youtubeKeySet = false;
let tavilyKeySet = false;

console.log('='.repeat(50));
console.log('ContentBot Setup');
console.log('='.repeat(50));
console.log('This script will help you set up ContentBot for generating blog posts.');
console.log('');

// Check if .env file exists
if (fs.existsSync('.env')) {
  console.log('Found existing .env file.');

  // Read existing .env file
  const envContent = fs.readFileSync('.env', 'utf8');

  // Check if GROQ_API_KEY is already set
  if (envContent.includes('GROQ_API_KEY=') && !envContent.includes('GROQ_API_KEY=your_groq_api_key_here') && !envContent.includes('GROQ_API_KEY=')) {
    console.log('GROQ_API_KEY is already set in .env file.');
    groqKeySet = true;
  }

  // Check if YOUTUBE_API_KEY is already set
  if (envContent.includes('YOUTUBE_API_KEY=') && !envContent.includes('YOUTUBE_API_KEY=your_youtube_api_key_here') && !envContent.includes('YOUTUBE_API_KEY=')) {
    console.log('YOUTUBE_API_KEY is already set in .env file.');
    youtubeKeySet = true;
  }

  // Check if TAVILY_API_KEY is already set
  if (envContent.includes('TAVILY_API_KEY=') && !envContent.includes('TAVILY_API_KEY=your_tavily_api_key_here') && !envContent.includes('TAVILY_API_KEY=')) {
    console.log('TAVILY_API_KEY is already set in .env file.');
    tavilyKeySet = true;
  }
}

// Prompt for GROQ API key if not set
if (!groqKeySet) {
  rl.question('Enter your Groq API key (get one from https://console.groq.com/keys): ', (apiKey) => {
    if (apiKey) {
      // Write API key to .env file
      fs.writeFileSync('.env', `GROQ_API_KEY=${apiKey}\n`, { flag: 'w' });
      console.log('GROQ API key saved to .env file.');

      // Prompt for YouTube API key
      promptForYouTubeKey();
    }
    else {
      console.log('No API key provided. You will need to add it manually to the .env file.');
      promptForYouTubeKey();
    }
  });
}
else {
  promptForYouTubeKey();
}

// Prompt for YouTube API key if not set
function promptForYouTubeKey() {
  if (!youtubeKeySet) {
    rl.question('Enter your YouTube API key (optional, get one from https://console.cloud.google.com/apis/credentials): ', (apiKey) => {
      if (apiKey) {
        // Append YouTube API key to .env file
        fs.appendFileSync('.env', `YOUTUBE_API_KEY=${apiKey}\n`);
        console.log('YouTube API key saved to .env file.');
      }
      else {
        console.log('No YouTube API key provided. YouTube scraping will not be available.');
      }

      // Prompt for Tavily API key
      promptForTavilyKey();
    });
  }
  else {
    promptForTavilyKey();
  }
}

// Prompt for Tavily API key if not set
function promptForTavilyKey() {
  if (!tavilyKeySet) {
    rl.question('Enter your Tavily API key (optional, get one from https://tavily.com/): ', (apiKey) => {
      if (apiKey) {
        // Append Tavily API key to .env file
        fs.appendFileSync('.env', `TAVILY_API_KEY=${apiKey}\n`);
        console.log('Tavily API key saved to .env file.');
      }
      else {
        console.log('No Tavily API key provided. Tavily search will not be available as a fallback for news.');
      }

      // Continue with setup
      installDependencies();
    });
  }
  else {
    installDependencies();
  }
}

function installDependencies() {
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
  console.log('  node create-blog.js --topic "Your Topic" --output "./output/custom-name.md" --model "llama3-8b-8192" --bing 3 --tavily 2 --reddit 5 --youtube 2 --subreddit "technology"');
  console.log('');
  console.log('Reddit scraping:');
  console.log('  npm run scrape-reddit -- --query "Your Search Query" --max 10 --subreddit "technology"');
  console.log('');
  console.log('YouTube scraping:');
  console.log('  npm run scrape-youtube -- --query "Your Search Query" --max 5');
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
            execSync(`node create-blog.js --topic "${topic}" --output "./output/test-blog.md" --bing 2 ${redditOption}`, { stdio: 'inherit' });
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
