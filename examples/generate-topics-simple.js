require('dotenv').config();
const path = require('path');
const ContentBot = require('../lib/index.js');

async function main() {
  try {
    // Create a new ContentBot instance
    const bot = new ContentBot();

    // Generate topics with hardcoded parameters
    const result = await bot.generateTopics('Dallas Mavericks', {
      count: 3,
      audience: 'business owners',
      outputPath: path.join(__dirname, '../output/test-topics.json'),
      researchMode: 'basic'  // Use basic mode to avoid Reddit/YouTube dependencies
    });

    // Log the results
    console.log('\nGenerated Topics:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the example
main();
