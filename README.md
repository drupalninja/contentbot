# ContentBot

A Node.js module that generates blog content using Groq AI, with the ability to incorporate current news articles and YouTube videos.

## Features

- Generate comprehensive, engaging blog posts on any topic
- Automatically fetch and incorporate relevant news articles from multiple sources:
  - Bing News
  - Tavily Search API
- Scrape and integrate YouTube videos related to your topic
- Fetch and incorporate Reddit posts and discussions
- Format output in Markdown with proper headings, lists, and emphasis
- Customize the AI model used for generation
- Save all generated content to the output directory

## Installation

### Global Installation

```bash
npm install -g contentbot
```

### Local Installation

```bash
npm install contentbot
```

## Usage

### CLI Usage

If installed globally:

```bash
contentbot create-blog --topic "Your Topic Here"
```

If installed locally:

```bash
npx contentbot create-blog --topic "Your Topic Here"
```

### Programmatic Usage

```javascript
const ContentBot = require('contentbot');

// Create a new ContentBot instance
const contentBot = new ContentBot({
  groqApiKey: process.env.GROQ_API_KEY, // Or pass your API key directly
  model: 'llama3-70b-8192', // Optional, this is the default
});

// Generate a blog post
async function generateBlog() {
  try {
    const result = await contentBot.createBlog('Artificial Intelligence Ethics', {
      outputPath: './output/ai-ethics.md',
      model: 'llama3-70b-8192', // Optional override
    });

    console.log(`Blog post written to: ${result.filePath}`);
    console.log(`Content: ${result.content}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

generateBlog();
```

### Advanced Options

You can also use the individual methods directly:

```javascript
// Generate blog content without saving to a file
const blogContent = await contentBot.generateBlogContent('Climate Change');

// Save content to a file
contentBot.writeToMarkdownFile(blogContent, './output/climate-change.md');
```

## CLI Options

### Create Blog Command

```bash
contentbot create-blog --topic "Your Topic" --output "./output/custom-name.md" --model "llama3-8b-8192"
```

#### Options:

- `--topic`, `-t`: Topic for the blog post (required)
- `--output`, `-o`: Output file path (default: `./output/blog-post.md`)
- `--model`, `-m`: Groq model to use (default: `llama3-70b-8192`)
- `--help`, `-h`: Show help

Note: The scraping options (`--bing`, `--tavily`, `--reddit`, `--youtube`) are currently placeholders in the module version and will be implemented in a future update.

## Requirements

- Node.js 14 or higher
- A Groq API key

## Environment Variables

You can set the following environment variables in a `.env` file:

```
GROQ_API_KEY=your_groq_api_key_here
```

Get your Groq API key from [https://console.groq.com/keys](https://console.groq.com/keys)

## License

MIT
