// Example of using ContentBot programmatically
require('dotenv').config();
const ContentBot = require('../lib/index');

// Create a new ContentBot instance
const contentBot = new ContentBot({
  groqApiKey: process.env.GROQ_API_KEY,
  model: 'llama3-70b-8192',
});

// Generate a blog post
async function generateBlog() {
  try {
    console.log('Generating blog post about "Artificial Intelligence Ethics"...');

    const result = await contentBot.createBlog('Artificial Intelligence Ethics', {
      outputPath: './output/ai-ethics.md',
    });

    console.log(`Blog post written to: ${result.filePath}`);
    console.log(`First 100 characters: ${result.content.substring(0, 100)}...`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the example
generateBlog();
