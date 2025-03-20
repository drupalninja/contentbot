require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Groq } = require('groq-sdk');
const generateTopicsModule = require('../bin/generate-topics');

/**
 * ContentBot class for generating blog content.
 */
class ContentBot {
  /**
   * Create a new ContentBot instance.
   * @param {Object} config - Configuration options.
   * @param {string} config.groqApiKey - Groq API key.
   * @param {string} config.model - Groq model to use (default: 'llama3-70b-8192').
   */
  constructor(config = {}) {
    this.groqApiKey = config.groqApiKey || process.env.GROQ_API_KEY;
    this.model = config.model || 'llama3-70b-8192';

    if (!this.groqApiKey) {
      throw new Error('Groq API key is required. Pass it in the constructor or set GROQ_API_KEY environment variable.');
    }

    this.groq = new Groq({
      apiKey: this.groqApiKey,
    });
  }

  /**
   * Generate blog content using Groq API.
   * @param {string} topic - The topic for the blog post.
   * @param {Object} options - Additional options.
   * @param {string} options.model - Override the default model.
   * @returns {Promise<Object>} - The generated blog content with structured fields.
   */
  async generateBlogContent(topic, options = {}) {
    try {
      const model = options.model || this.model;

      const prompt = `
      Write a comprehensive, engaging, and informative blog post about "${topic}".

      The blog post should be formatted in a structured way with the following components:

      1. TITLE: A catchy, SEO-friendly title (max 70 characters)

      2. META_DESCRIPTION: A compelling meta description summarizing the post (max 160 characters)

      3. SUMMARY: A brief 2-3 sentence summary of the entire post

      4. TAGS: 5-7 relevant keywords or tags for the post, comma-separated

      5. BODY: The main content with:
         - An introduction that hooks the reader
         - At least 3-5 main sections with appropriate headings
         - Relevant facts, examples, and insights
         - A conclusion with a call to action
         - Formatted in proper Markdown

      Use proper Markdown syntax in the BODY section:
      - # for the main title (don't include the title again, it will be used from the TITLE field)
      - ## for section headings
      - ### for sub-section headings
      - **bold** for emphasis
      - *italic* for secondary emphasis
      - > for blockquotes
      - - for bullet points
      - 1. for numbered lists

      The BODY should be between 800-1200 words.

      Format your response exactly as follows:

      TITLE: The title goes here
      META_DESCRIPTION: The meta description goes here
      SUMMARY: The summary goes here
      TAGS: tag1, tag2, tag3, tag4, tag5
      BODY:

      The markdown content starts here...
      `;

      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        model: model,
      });

      const content = completion.choices[0]?.message?.content || '';

      // Parse the structured content
      const structuredContent = this.parseStructuredContent(content);

      return structuredContent;
    } catch (error) {
      throw new Error(`Error generating blog content: ${error.message}`);
    }
  }

  /**
   * Parse the structured content returned by the LLM.
   * @param {string} content - The raw content from the LLM.
   * @returns {Object} - The parsed structured content.
   */
  parseStructuredContent(content) {
    const titleMatch = content.match(/TITLE:(.*?)(?=META_DESCRIPTION:|$)/s);
    const metaDescriptionMatch = content.match(/META_DESCRIPTION:(.*?)(?=SUMMARY:|$)/s);
    const summaryMatch = content.match(/SUMMARY:(.*?)(?=TAGS:|$)/s);
    const tagsMatch = content.match(/TAGS:(.*?)(?=BODY:|$)/s);
    const bodyMatch = content.match(/BODY:(.*)/s);

    // Process tags into an array
    let tags = [];
    if (tagsMatch && tagsMatch[1]) {
      tags = tagsMatch[1].trim().split(',').map(tag => tag.trim());
    }

    return {
      title: titleMatch ? titleMatch[1].trim() : '',
      metaDescription: metaDescriptionMatch ? metaDescriptionMatch[1].trim() : '',
      summary: summaryMatch ? summaryMatch[1].trim() : '',
      tags: tags,
      body: bodyMatch ? bodyMatch[1].trim() : content, // Fallback to the entire content if parsing fails
      rawContent: content // Include the raw content for debugging
    };
  }

  /**
   * Write content to a markdown file.
   * @param {string} content - The content to write.
   * @param {string} outputPath - The path to write the file to.
   */
  writeToMarkdownFile(content, outputPath) {
    try {
      // Ensure the directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write the content to the file
      fs.writeFileSync(outputPath, content);
      return outputPath;
    } catch (error) {
      throw new Error(`Error writing to file: ${error.message}`);
    }
  }

  /**
   * Generate blog topic ideas
   * @param {string} category - The category for topic generation
   * @param {Object} options - Additional options
   * @param {number} options.count - Number of topics to generate
   * @param {string} options.audience - Target audience for the topics
   * @param {string} options.outputPath - Optional path to save the topics
   * @param {string} options.model - Override the default model
   * @param {string|Array} options.keywords - Keywords to include in topics
   * @param {string} options.researchMode - 'basic' or 'enhanced'
   * @param {number} options.bingCount - Number of Bing news articles to fetch
   * @param {number} options.tavilyCount - Number of Tavily search results to fetch
   * @returns {Promise<Object>} - Object containing the generated topics
   */
  async generateTopics(category, options = {}) {
    // Use the imported generateTopics function with proper parameters
    return await generateTopicsModule.generateTopics(
      category,
      options.count || 5,
      options.audience || 'general',
      options.outputPath || null,
      options.model || this.model,
      options.keywords || [],
      {
        bingCount: options.bingCount || 5,
        tavilyCount: options.tavilyCount || 5,
        researchMode: options.researchMode || 'enhanced'
      }
    );
  }

  /**
   * Generate a blog post and save it to a file.
   * @param {string} topic - The topic for the blog post.
   * @param {Object} options - Additional options.
   * @param {string} options.outputPath - The path to save the blog post.
   * @param {string} options.model - The model to use.
   * @returns {Promise<Object>} - Object containing the blog content and file path.
   */
  async createBlog(topic, options = {}) {
    const outputPath = options.outputPath || './output/blog-post.md';
    const model = options.model || this.model;

    const blogStructured = await this.generateBlogContent(topic, { model });

    // Format the structured content into a complete markdown document
    const completeMarkdown = `# ${blogStructured.title}\n\n${blogStructured.body}`;

    const filePath = this.writeToMarkdownFile(completeMarkdown, outputPath);

    return {
      content: completeMarkdown,
      filePath,
      structuredContent: blogStructured
    };
  }
}

// Export the main ContentBot class
module.exports = ContentBot;

// Export core functions only
module.exports.generateBlogContent = async (topic, model, groqApiKey) => {
  const contentBot = new ContentBot({
    groqApiKey: groqApiKey || process.env.GROQ_API_KEY,
    model: model,
  });
  return contentBot.generateBlogContent(topic, { model });
};

module.exports.writeToMarkdownFile = (content, outputPath) => {
  const contentBot = new ContentBot({
    groqApiKey: process.env.GROQ_API_KEY,
  });
  return contentBot.writeToMarkdownFile(content, outputPath);
};

// Export generate-topics functions
module.exports.generateTopics = generateTopicsModule.generateTopics;
module.exports.generateTopicIdeas = generateTopicsModule.generateTopicIdeas;
