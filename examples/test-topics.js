/**
 * Simple test script for ContentBot topic generation
 */

// Load environment variables
require('dotenv').config();

// Import the generateTopics function directly
const { generateTopics } = require('../bin/generate-topics');

async function testTopicGeneration() {
  try {
    console.log('Testing ContentBot Topic Generation\n');

    // Test topic to generate ideas for
    const testCategory = 'Dallas Mavericks';

    console.log(`Generating topics for: ${testCategory}`);
    console.log('Using enhanced research mode with additional data sources\n');

    // Generate topics with enhanced research
    const result = await generateTopics(
      testCategory,  // category
      3,            // count
      'basketball fans', // audience
      null,         // outputPath (null to keep in memory)
      'llama3-70b-8192', // model
      'Luka Doncic,NBA playoffs,Kyrie Irving', // keywords
      {
        bingCount: 5,
        tavilyCount: 3,
        researchMode: 'enhanced'
      }
    );

    // Display results
    console.log(`\nGenerated ${result.topics.length} topic ideas:\n`);

    result.topics.forEach((topic, i) => {
      console.log(`Topic ${i + 1}: ${topic.title}`);
      console.log(`Summary: ${topic.summary}`);
      console.log(`Target Keyword: ${topic.targetKeyword}`);
      console.log('Key Points:');
      topic.keyPoints.forEach(point => {
        console.log(`- ${point}`);
      });
      console.log('');
    });

    // Show research sources used
    if (result.additionalResearch) {
      console.log('Research sources used:');
      const newsCount = result.additionalResearch.newsArticles?.length || 0;
      const redditCount = result.additionalResearch.redditPosts?.length || 0;
      const youtubeCount = result.additionalResearch.youtubeVideos?.length || 0;

      console.log(`- News articles: ${newsCount}`);
      console.log(`- Reddit posts: ${redditCount}`);
      console.log(`- YouTube videos: ${youtubeCount}`);
    }

  } catch (error) {
    console.error('Error testing ContentBot:', error);
  }
}

// Run the test
testTopicGeneration();
