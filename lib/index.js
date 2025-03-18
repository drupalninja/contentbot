require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Groq } = require('groq-sdk');

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
   * @returns {Promise<string>} - The generated blog content.
   */
  async generateBlogContent(topic, options = {}) {
    try {
      const model = options.model || this.model;

      const prompt = `
      Write a comprehensive, engaging, and informative blog post about "${topic}".

      The blog post should:
      - Have a catchy title
      - Include an introduction that hooks the reader
      - Contain at least 3-5 main sections with appropriate headings
      - Include relevant facts, examples, and insights
      - End with a conclusion and call to action
      - Be written in a conversational yet professional tone
      - Be formatted in Markdown

      Format the blog post with proper Markdown syntax including:
      - # for the main title
      - ## for section headings
      - ### for sub-section headings
      - **bold** for emphasis
      - *italic* for secondary emphasis
      - > for blockquotes
      - - for bullet points
      - 1. for numbered lists

      The blog post should be between 800-1200 words.
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

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      throw new Error(`Error generating blog content: ${error.message}`);
    }
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

    const blogContent = await this.generateBlogContent(topic, { model });
    const filePath = this.writeToMarkdownFile(blogContent, outputPath);

    return {
      content: blogContent,
      filePath,
    };
  }
}

module.exports = ContentBot;

// Export individual functions for backwards compatibility
module.exports.generateBlogContent = async (topic, model, groqApiKey) => {
  const contentBot = new ContentBot({
    groqApiKey: groqApiKey || process.env.GROQ_API_KEY,
    model: model,
  });
  return contentBot.generateBlogContent(topic);
};

module.exports.writeToMarkdownFile = (content, outputPath) => {
  const contentBot = new ContentBot({
    groqApiKey: process.env.GROQ_API_KEY,
  });
  return contentBot.writeToMarkdownFile(content, outputPath);
};
