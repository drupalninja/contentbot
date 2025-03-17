# ContentBot

A Node.js script that generates blog content using Groq AI, with the ability to incorporate current news articles.

## Features

- Generate comprehensive, engaging blog posts on any topic
- Automatically fetch and incorporate relevant news articles from Bing News
- Format output in Markdown with proper headings, lists, and emphasis
- Customize the AI model used for generation

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
2. Create a `.env` file in the root directory with your Groq API key:
   ```
   GROQ_API_KEY=your_api_key_here
   ```
   Get your API key from [https://console.groq.com/keys](https://console.groq.com/keys)

## Usage

### Basic Usage

```bash
npm run create-blog -- --topic "Your Topic Here"
```

This will generate a blog post about your topic and save it to `./blog-post.md`.

### Advanced Options

```bash
node create-blog.js --topic "Your Topic" --output "./custom-path.md" --model "llama3-8b-8192" --news 5
```

#### Options:

- `--topic`, `-t`: Topic for the blog post (required)
- `--output`, `-o`: Output file path (default: `./blog-post.md`)
- `--model`, `-m`: Groq model to use (default: `llama3-70b-8192`)
- `--news`, `-n`: Number of news articles to fetch (0-5, default: 3)
- `--help`, `-h`: Show help

## Examples

Generate a blog post about AI ethics with 3 news articles:
```bash
npm run create-blog -- --topic "Artificial Intelligence Ethics" --news 3
```

Generate a blog post about climate change without news articles:
```bash
npm run create-blog -- --topic "Climate Change" --news 0
```

Generate a blog post about cryptocurrency using a different model:
```bash
npm run create-blog -- --topic "Cryptocurrency Trends" --model "llama3-8b-8192"
```

## License

MIT
