/**
 * Example showing how to use ContentBot programmatically
 *
 * This example demonstrates how to:
 * 1. Generate blog topic ideas
 * 2. Create a blog post for one of the generated topics
 */

// Load environment variables
require('dotenv').config();

// Import the functions from the respective files
const { generateTopics } = require('../generate-topics');
const { createBlog } = require('../create-blog');

// Main example function
async function runExample() {
  try {
    console.log('Content Bot Example - Programmatic Usage\n');

    // Step 1: Generate topic ideas
    console.log('Step 1: Generating topic ideas...');

    const category = 'Digital Marketing';
    const audience = 'small business owners';
    const topicCount = 3;

    // Method 1: Generate topics and save to file
    console.log('\nMethod 1: Generate topics and save to file:');
    const topicsResult1 = await generateTopics(
      category,
      topicCount,
      audience,
      './output/marketing-topics.json',
      'llama3-70b-8192',
      'SEO,social media,marketing strategy'
    );

    console.log(`\nGenerated ${topicsResult1.topics.length} topic ideas for ${category}`);

    // Method 2: Generate topics WITHOUT saving to file (pass null or empty string for outputPath)
    console.log('\nMethod 2: Generate topics without saving to file:');
    const topicsResult2 = await generateTopics(
      'Content Marketing',
      topicCount,
      audience,
      null, // Pass null to skip file writing
      'llama3-70b-8192',
      'content strategy,blogging,lead generation'
    );

    console.log(`\nGenerated ${topicsResult2.topics.length} topic ideas for Content Marketing`);

    // Display the generated topics
    topicsResult2.topics.forEach((topic, index) => {
      console.log(`\nTopic ${index + 1}: ${topic.title}`);
      console.log(`Summary: ${topic.summary}`);
      console.log(`Target keyword: ${topic.targetKeyword}`);
    });

    // Step 2: Create a blog post from the first topic
    if (topicsResult2.topics.length > 0) {
      console.log('\n\nStep 2: Creating a blog post from the first topic...');

      const selectedTopic = topicsResult2.topics[0];
      console.log(`Selected topic: ${selectedTopic.title}`);

      // Create a blog post using the selected topic
      const blogResult = await createBlog(selectedTopic.title, {
        outputPath: './output/generated-blog.md',
        model: 'llama3-70b-8192',
        bingCount: 3,  // Number of Bing news articles to fetch
        tavilyCount: 2, // Number of Tavily search results to fetch
        redditCount: 2, // Number of Reddit posts to fetch
        youtubeCount: 2, // Number of YouTube videos to fetch
        keywords: selectedTopic.targetKeyword,
      });

      console.log(`\nBlog post created successfully!`);
      console.log(`Output file: ${blogResult.filePath}`);
      console.log(`Content length: ${blogResult.content.length} characters`);
    }

    console.log('\nExample completed successfully!');
  } catch (error) {
    console.error('Error running example:', error);
  }
}

// Run the example
runExample();
