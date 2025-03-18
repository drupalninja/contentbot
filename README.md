# ContentBot

A Node.js script that generates blog content using Groq AI, with the ability to incorporate current news articles and YouTube videos.

## Features

- Generate comprehensive, engaging blog posts on any topic
- Automatically fetch and incorporate relevant news articles from multiple sources:
  - Bing News
  - Tavily Search API
- Scrape and integrate YouTube videos related to your topic
- Format output in Markdown with proper headings, lists, and emphasis
- Customize the AI model used for generation
- Save all generated content to the output directory

## Installation

1. Clone this repository
2. Run the setup script:
   ```
   npm run setup
   ```
   This will:
   - Guide you through setting up your Groq API key
   - Install dependencies
   - Offer to run a test blog generation

Alternatively, you can set up manually:
1. Install dependencies:
   ```
   npm install
   ```
2. Create a `.env` file in the root directory with your API keys:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   YOUTUBE_API_KEY=your_youtube_api_key_here
   TAVILY_API_KEY=your_tavily_api_key_here
   ```
   Get your Groq API key from [https://console.groq.com/keys](https://console.groq.com/keys)
   Get your YouTube API key from [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
   Get your Tavily API key from [https://tavily.com/](https://tavily.com/)

## Usage

### Basic Usage

```bash
npm run create-blog -- --topic "Your Topic Here"
```

This will generate a blog post about your topic and save it to `./output/blog-post.md`.

### Advanced Options

```bash
node create-blog.js --topic "Your Topic" --output "./output/custom-name.md" --model "llama3-8b-8192" --bing 3 --tavily 2 --youtube 3
```

#### Options:

- `--topic`, `-t`: Topic for the blog post (required)
- `--output`, `-o`: Output file path (default: `./output/blog-post.md`)
- `--model`, `-m`: Groq model to use (default: `llama3-70b-8192`)
- `--bing`, `-b`: Number of Bing news articles to fetch (0-5, default: 3)
- `--tavily`: Number of Tavily search results to fetch (0-5, default: 0)
- `--youtube`, `-y`: Number of YouTube videos to fetch (0-5, default: 0)
- `--help`, `-h`: Show help

## Examples

Generate a blog post about AI ethics with Bing news, Tavily search, and YouTube videos:
```bash
npm run create-blog -- --topic "Artificial Intelligence Ethics" --bing 2 --tavily 2 --youtube 3
```

Generate a blog post about climate change with only Tavily search results:
```bash
npm run create-blog -- --topic "Climate Change" --bing 0 --tavily 3 --youtube 0
```

Generate a blog post about cryptocurrency using a different model:
```bash
npm run create-blog -- --topic "Cryptocurrency Trends" --model "llama3-8b-8192" --bing 2 --youtube 2
```

## Scraping YouTube Videos Separately

You can also scrape YouTube videos separately without generating a blog post:

```bash
npm run scrape-youtube -- --query "Your Search Query" --max 10 --output "./output/youtube-videos.json"
```

#### Options:

- `--query`, `-q`: Search query for YouTube videos (required)
- `--max`, `-m`: Maximum number of videos to fetch (1-50, default: 5)
- `--output`, `-o`: Output JSON file path (default: `./output/youtube-videos.json`)
- `--order`: Sort order (relevance, date, rating, viewCount, title) (default: relevance)
- `--type`: Type of video to search for (video, channel, playlist) (default: video)
- `--help`, `-h`: Show help

## Output Directory

All generated blog posts are saved to the `./output/` directory by default. You can specify a different output path using the `--output` option.

## Requirements

- Node.js 14 or higher
- A Groq API key
- A YouTube Data API key (for YouTube video scraping)

## License

MIT
