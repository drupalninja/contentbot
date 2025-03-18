require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Groq } = require('groq-sdk');
const https = require('https');

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Initialize Tavily client
let tavilyClient = null;

// Function to initialize Tavily
async function initTavily() {
  if (!process.env.TAVILY_API_KEY) {
    return false;
  }

  try {
    const { TavilyClient } = await import('tavily');
    tavilyClient = new TavilyClient({
      apiKey: process.env.TAVILY_API_KEY,
    });
    return true;
  } catch (error) {
    console.error('Failed to initialize Tavily API:', error.message);
    return false;
  }
}

// Function to fetch news from Bing
async function fetchBingNews(topic, count = 5) {
  return new Promise((resolve, reject) => {
    const encodedTopic = encodeURIComponent(topic);
    const url = `https://www.bing.com/news/search?q=${encodedTopic}&format=rss`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const articles = [];
          const regex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<description>(.*?)<\/description>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g;
          let match;
          while ((match = regex.exec(data)) !== null && articles.length < count) {
            articles.push({
              title: match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
              link: match[2],
              description: match[3].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/<.*?>/g, ''),
              pubDate: match[4],
              source: 'Bing News'
            });
          }
          resolve(articles);
        } catch (error) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

// Function to fetch news from Tavily
async function fetchTavilyNews(topic, count = 5) {
  if (!tavilyClient) return [];

  try {
    const response = await tavilyClient.search({
      query: `latest trends and topics about ${topic}`,
      search_depth: "advanced",
      include_domains: ["news.google.com", "cnn.com", "bbc.com", "reuters.com", "bloomberg.com", "nytimes.com", "wsj.com", "theguardian.com", "apnews.com", "npr.org"],
      max_results: count,
      include_answer: false,
      include_raw_content: false,
    });

    if (response?.results?.length > 0) {
      return response.results.map(result => ({
        title: result.title || 'No title available',
        link: result.url,
        description: result.content || result.snippet || 'No description available',
        pubDate: new Date().toISOString(),
        source: 'Tavily Search'
      }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching Tavily news:', error.message);
    return [];
  }
}

// Main function to generate topics
async function generateTopics(category, count = 3) {
  try {
    console.log(`Generating ${count} topic ideas for ${category}...`);

    // Initialize Tavily
    await initTavily();

    // Fetch news articles
    console.log('Fetching news articles...');
    const [bingArticles, tavilyArticles] = await Promise.all([
      fetchBingNews(category, 5),
      fetchTavilyNews(category, 5)
    ]);

    const allArticles = [...bingArticles, ...tavilyArticles];
    console.log(`Found ${allArticles.length} total articles`);

    // Generate topics using Groq
    const prompt = `
You are a specialized AI that ONLY outputs valid, parseable JSON.

Your task is to generate ${count} unique and engaging blog topic ideas related to "${category}".
Your topic ideas MUST be based on the CURRENT and UP-TO-DATE information I've provided about this subject.

For each topic idea, include:
- A catchy, SEO-friendly title
- A 2-3 sentence summary explaining what the blog post would cover
- 3-5 key points that would be addressed
- A suggested primary keyword for SEO
- Explanation of why this topic is valuable to the target audience

The output MUST be valid JSON with this exact structure:
{
  "category": "${category}",
  "audience": "business owners",
  "generatedAt": "${new Date().toISOString().split('T')[0]}",
  "topics": [
    {
      "title": "Example Title",
      "summary": "Example summary.",
      "keyPoints": ["Point 1", "Point 2", "Point 3"],
      "targetKeyword": "keyword",
      "valueProposition": "Why it's valuable."
    }
  ]
}

Here are some recent news articles related to this category that you should use for inspiration:

${allArticles.map((article, index) => `
Article ${index + 1}:
Title: ${article.title}
Description: ${article.description}
Date: ${article.pubDate}
Link: ${article.link}
`).join('\n')}

IMPORTANT:
1. Make topics CURRENT and UP-TO-DATE - avoid suggesting outdated information
2. Check the accuracy of specific entities mentioned (people, products, teams, etc.)
3. Make topics specific, actionable, and based on current trends
4. Focus on unique angles and innovative approaches
5. Your response MUST only contain the JSON object - no markdown, no explanations, no extra text
6. Ensure all JSON keys and string values are properly double-quoted
7. Do not use single quotes in your JSON
8. Do not include comments in the JSON
9. Verify your response is valid JSON before returning it
`;

    // Generate completion with Groq
    console.log('Generating topics...');
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192",
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No content received from Groq API');

    // Parse and save the result
    const result = JSON.parse(content);
    const outputPath = path.join(__dirname, '../output/test-topics.json');

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write to file
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Topics saved to ${outputPath}`);

    // Log results
    console.log('\nGenerated Topics:');
    console.log(JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Run the example
generateTopics('Dallas Mavericks', 3)
  .catch(error => {
    console.error('Failed to generate topics:', error);
    process.exit(1);
  });
