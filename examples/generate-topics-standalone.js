require('dotenv').config();
const path = require('path');
const { Groq } = require('groq-sdk');
const generateTopicsModule = require('../bin/generate-topics');

async function main() {
  try {
    // Initialize Groq client (required by generate-topics)
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    // Define the parameters exactly as they would be in the CLI version
    const category = 'Dallas Mavericks';
    const count = 3;
    const audience = 'business owners';
    const outputPath = path.join(__dirname, '../output/test-topics.json');
    const model = 'llama3-70b-8192';
    const keywords = [];
    const options = {
      bingCount: 5,
      tavilyCount: 5,
      researchMode: 'basic'  // Use basic mode to skip Reddit and YouTube
    };

    console.log(`Generating ${count} topic ideas for ${category} targeting ${audience}...`);

    // Generate topics using the generateTopics function directly
    const result = await generateTopicsModule.generateTopics(
      category,
      count,
      audience,
      outputPath,
      model,
      keywords,
      options
    );

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
