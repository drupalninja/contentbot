require('dotenv').config();
const path = require('path');
const ContentBot = require('../lib/index.js');

async function main() {
  try {
    // Create a new ContentBot instance
    const bot = new ContentBot({
      model: 'llama3-70b-8192',
    });

    // Define the parameters
    const options = {
      category: 'Dallas Mavericks',
      count: 3,
      audience: 'business owners',
      outputPath: path.join(__dirname, '../output/test-topics.json'),
      model: 'llama3-70b-8192',
      keywords: [],
      bingCount: 5,
      tavilyCount: 5,
      researchMode: 'basic',
    };

    console.log(`Generating ${options.count} topic ideas for ${options.category} targeting ${options.audience}...`);

    // Generate topics using the ContentBot class
    const result = await bot.generateTopics(options.category, options);

    // Log the results
    console.log('\nGenerated Topics:');
    console.log(JSON.stringify(result, null, 2));

    // You can also access specific parts of the result
    console.log('\nNumber of topics generated:', result.topics.length);
    console.log('Target audience:', result.audience);
    console.log('Generation date:', result.generatedAt);

    // Example of accessing the first topic
    if (result.topics.length > 0) {
      console.log('\nFirst Topic:');
      console.log('Title:', result.topics[0].title);
      console.log('Summary:', result.topics[0].summary);
      console.log('Key Points:', result.topics[0].keyPoints);
      console.log('Target Keyword:', result.topics[0].targetKeyword);
      console.log('Value Proposition:', result.topics[0].valueProposition);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the example
main();
