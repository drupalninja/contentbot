/**
 * Test script for ContentBot
 *
 * This script tests the enhanced topic generation features
 * with current research data.
 */

// Load environment variables
require('dotenv').config();

// Import ContentBot
const ContentBot = require('../lib/index');

async function testTopicGeneration() {
  try {
    console.log('Testing ContentBot Topic Generation\n');

    // Create ContentBot instance
    const contentBot = new ContentBot();

    // Test topic to generate ideas for
    const testCategory = 'Dallas Mavericks';

    console.log(`Generating topics for: ${testCategory}`);
    console.log('Using enhanced research mode with Reddit and YouTube data\n');

    // Generate topics with enhanced research
    const result = await contentBot.generateTopics(testCategory, {
      count: 3,
      audience: 'basketball fans',
      bingCount: 5,
      tavilyCount: 5,
      keywords: 'Luka Doncic,NBA playoffs,Kyrie Irving',
      researchMode: 'enhanced'
    });

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
    console.log('Research sources used:');
    console.log(`- News articles: ${result.additionalResearch?.newsArticles?.length || 0}`);
    console.log(`- Reddit posts: ${result.additionalResearch?.redditPosts?.length || 0}`);
    console.log(`- YouTube videos: ${result.additionalResearch?.youtubeVideos?.length || 0}`);

  } catch (error) {
    console.error('Error testing ContentBot:', error);
  }
}

// Run the test
testTopicGeneration();
