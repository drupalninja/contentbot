# ContentBot

A Node.js module that generates blog content and topic ideas using Groq AI, with the ability to incorporate current news articles and research from multiple sources.

## Features

- Generate comprehensive, engaging blog posts on any topic
- Generate topic ideas with SEO-friendly titles and summaries
- Automatically fetch and incorporate relevant news articles from multiple sources:
  - Bing News
  - Tavily Search API
- Optional enhanced research mode that can include:
  - Reddit posts and discussions
  - YouTube videos
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
# Generate a blog post
contentbot create-blog --topic "Your Topic Here"

# Generate topic ideas
contentbot generate-topics --category "Your Category" --count 3
```

If installed locally:

```bash
# Generate a blog post
npx contentbot create-blog --topic "Your Topic Here"

# Generate topic ideas
npx contentbot generate-topics --category "Your Category" --count 3
```

### Simple Programmatic Usage

```javascript
const ContentBot = require('contentbot');

// Create a new ContentBot instance
const contentBot = new ContentBot();

// Generate topic ideas
async function generateTopics() {
  try {
    const result = await contentBot.generateTopics('Digital Marketing', {
      count: 3,
      audience: 'business owners',
      outputPath: './output/topics.json',
      researchMode: 'basic'  // Use 'enhanced' for Reddit/YouTube research
    });

    console.log('Generated Topics:', result.topics);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Generate a blog post
async function generateBlog() {
  try {
    const result = await contentBot.createBlog('Artificial Intelligence Ethics', {
      outputPath: './output/ai-ethics.md',
    });

    console.log(`Blog post written to: ${result.filePath}`);
    console.log(`Content: ${result.content}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}
```

### Advanced Usage

The package includes example files demonstrating both simple and advanced usage:

```javascript
const ContentBot = require('contentbot');

// Create a new ContentBot instance with custom configuration
const contentBot = new ContentBot({
  model: 'llama3-70b-8192',
});

// Generate topics with all available options
const result = await contentBot.generateTopics('Digital Marketing', {
  count: 3,
  audience: 'business owners',
  outputPath: './output/topics.json',
  model: 'llama3-70b-8192',
  keywords: ['SEO', 'content strategy'],
  bingCount: 5,
  tavilyCount: 5,
  researchMode: 'enhanced'  // Includes Reddit and YouTube research
});
```

Check out the example files in the `examples` directory for more detailed usage:
- `generate-topics-simple.js` - Basic topic generation
- `generate-topics-example.js` - Advanced usage with all options

## CLI Options

### Generate Topics Command

```bash
contentbot generate-topics --category "Your Category" [options]
```

#### Options:

- `--category`, `-c`: Category for topic generation (required)
- `--count`, `-n`: Number of topics to generate (default: 5)
- `--output`, `-o`: Output file path (default: `./output/topic-ideas.json`)
- `--model`, `-m`: Groq model to use (default: `llama3-70b-8192`)
- `--audience`, `-a`: Target audience (default: "general")
- `--keywords`, `-k`: Keywords to include (comma-separated)
- `--bing`, `-b`: Number of Bing news articles to fetch (default: 3)
- `--tavily`: Number of Tavily search results to fetch (default: 3)

### Create Blog Command

```bash
contentbot create-blog --topic "Your Topic" [options]
```

#### Options:

- `--topic`, `-t`: Topic for the blog post (required)
- `--output`, `-o`: Output file path (default: `./output/blog-post.md`)
- `--model`, `-m`: Groq model to use (default: `llama3-70b-8192`)
- `--help`, `-h`: Show help

## Requirements

- Node.js 14 or higher
- A Groq API key
- (Optional) A Tavily API key for enhanced search results

## Environment Variables

Create a `.env` file with your API keys:

```
GROQ_API_KEY=your_groq_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here  # Optional
```

Get your API keys:
- Groq API key: [https://console.groq.com/keys](https://console.groq.com/keys)
- Tavily API key: [https://tavily.com](https://tavily.com)

## License

MIT
