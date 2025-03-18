/**
 * Example showing how to use ContentBot with in-memory data
 *
 * This example demonstrates how to:
 * 1. Generate blog topic ideas without writing to a file
 * 2. Process the topics in memory
 * 3. Create a blog post from one of the generated topics
 */

// Load environment variables
require('dotenv').config();

// Import ContentBot
const ContentBot = require('../lib/index');

// Main example function
async function runExample() {
  try {
    console.log('ContentBot Example - In-Memory Usage\n');

    // Create a ContentBot instance
    const contentBot = new ContentBot({
      // groqApiKey: process.env.GROQ_API_KEY, // Optional if set in .env
      model: 'llama3-70b-8192',
    });

    // Step 1: Generate topic ideas in memory (no file writing)
    console.log('Step 1: Generating topic ideas in memory...');

    // Using the object-based parameters
    const topicsResult = await contentBot.generateTopics('Social Media Marketing', {
      count: 5,
      audience: 'small business owners',
      // No outputPath means topics stay in memory only
      model: 'llama3-70b-8192',
      keywords: 'Instagram,TikTok,engagement,small business'
    });

    console.log(`\nGenerated ${topicsResult.topics.length} topic ideas for Social Media Marketing\n`);

    // Step 2: Process the topics in memory
    console.log('Step 2: Processing topics in memory...');

    // Sort topics by keyword relevance (example of in-memory processing)
    const targetKeyword = 'Instagram';
    const sortedTopics = [...topicsResult.topics].sort((a, b) => {
      const aHasKeyword = a.title.includes(targetKeyword) || a.targetKeyword.includes(targetKeyword);
      const bHasKeyword = b.title.includes(targetKeyword) || b.targetKeyword.includes(targetKeyword);

      if (aHasKeyword && !bHasKeyword) return -1;
      if (!aHasKeyword && bHasKeyword) return 1;
      return 0;
    });

    console.log(`\nTopics sorted by relevance to "${targetKeyword}":`);
    sortedTopics.forEach((topic, index) => {
      console.log(`\nTopic ${index + 1}: ${topic.title}`);
      console.log(`Summary: ${topic.summary}`);
      console.log(`Target keyword: ${topic.targetKeyword}`);

      // Show key points for the first topic only
      if (index === 0) {
        console.log(`Key points:`);
        topic.keyPoints.forEach(point => console.log(`- ${point}`));
      }
    });

    // Step 3: Create a blog post from the best topic
    if (sortedTopics.length > 0) {
      console.log('\n\nStep 3: Creating a blog post from the best matching topic...');

      const selectedTopic = sortedTopics[0]; // Take the first topic after sorting
      console.log(`Selected topic: ${selectedTopic.title}`);

      // Alternative method: Use the imported createBlogFromScratch function
      const { createBlogFromScratch } = require('../lib/index');

      // Create a blog post using the selected topic
      const blogResult = await createBlogFromScratch(selectedTopic.title, {
        outputPath: './output/social-media-blog.md',
        model: 'llama3-70b-8192',
        bingCount: 2,
        redditCount: 2,
        youtubeCount: 2,
        keywords: selectedTopic.targetKeyword,
      });

      console.log(`\nBlog post created successfully!`);
      console.log(`Output file: ${blogResult.filePath}`);
      console.log(`Content length: ${blogResult.content.length} characters`);

      // Example of working with the response data instead of file
      const firstParagraph = blogResult.content.split('\n\n')[1];
      console.log(`\nFirst paragraph preview: "${firstParagraph.substring(0, 100)}..."`);
    }

    console.log('\nExample completed successfully!');
  } catch (error) {
    console.error('Error running example:', error);
  }
}

// Run the example
runExample();
