require('dotenv').config();
const path = require('path');
const ContentBot = require('../lib/index');

async function main() {
  try {
    // Create a new ContentBot instance
    const contentBot = new ContentBot({
      model: 'llama3-70b-8192'
    });

    // Define the parameters
    const params = {
      category: 'Dallas Mavericks',
      count: 3,
      audience: 'business owners',
      outputPath: path.join(__dirname, '../output/test-topics.json'),
      model: 'llama3-70b-8192',
      keywords: [],
      bingCount: 5,
      tavilyCount: 5,
      researchMode: 'basic'
    };

    console.log(`Generating ${params.count} topic ideas for ${params.category} targeting ${params.audience}...`);

    // Generate topics using the ContentBot class
    const result = await contentBot.generateTopics(params.category, {
      count: params.count,
      audience: params.audience,
      outputPath: params.outputPath,
      model: params.model,
      keywords: params.keywords,
      bingCount: params.bingCount,
      tavilyCount: params.tavilyCount,
      researchMode: params.researchMode
    });

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
