/**
 * Direct test script for ContentBot topic generation
 * (bypassing command-line argument handling)
 */

// Load environment variables
require('dotenv').config();
const { Groq } = require('groq-sdk');
const fs = require('fs');
const path = require('path');

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function testTopicGeneration() {
  try {
    console.log('Testing ContentBot Topic Generation\n');

    // Test topic to generate ideas for
    const category = 'Dallas Mavericks';
    const count = 3;
    const audience = 'basketball fans';
    const keywords = 'Luka Doncic,NBA playoffs,Kyrie Irving';

    console.log(`Generating ${count} topics for: ${category}`);
    console.log(`Audience: ${audience}`);
    console.log(`Keywords: ${keywords}\n`);

    // Simulate the research process by fetching news directly
    console.log('Fetching news articles about Dallas Mavericks...');

    // Simple research fetch function - in a real app you would use the proper fetch functions
    const newsArticles = [
      {
        title: "Dallas Mavericks secure playoff spot with win over Miami Heat",
        description: "Luka Doncic and Kyrie Irving combine for 65 points as the Mavs clinch a playoff berth.",
        pubDate: new Date().toDateString(),
        link: "https://example.com/mavericks-playoffs"
      },
      {
        title: "Mavericks' defensive strategy proving effective in recent games",
        description: "Coach Jason Kidd's defensive adjustments have improved the team's performance.",
        pubDate: new Date().toDateString(),
        link: "https://example.com/mavericks-defense"
      }
    ];

    console.log(`Found ${newsArticles.length} news articles for research.`);

    // Manually create the prompt like in generate-topics.js
    let newsArticlesText = newsArticles.length > 0 ? `
Here are some recent news articles related to this category that you should use for inspiration:

${newsArticles.map((article, index) => `
Article ${index + 1}:
Title: ${article.title}
Description: ${article.description}
Date: ${article.pubDate}
Link: ${article.link}
`).join('\n')}

Please use these articles to identify current trends, controversies, or interesting angles for the topic ideas.
` : '';

    const prompt = `
You are a specialized AI that ONLY outputs valid, parseable JSON.

Your task is to generate ${count} unique and engaging blog topic ideas related to "${category}" for a ${audience} audience.
Your topic ideas MUST be based on the CURRENT and UP-TO-DATE information about the Dallas Mavericks.

For each topic idea, include:
- A catchy, SEO-friendly title
- A 2-3 sentence summary explaining what the blog post would cover
- 3-5 key points that would be addressed
- A suggested primary keyword for SEO
- Explanation of why this topic is valuable to the target audience

The output MUST be valid JSON with this exact structure:
{
  "category": "${category}",
  "audience": "${audience}",
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

${newsArticlesText}

IMPORTANT:
1. Make topics CURRENT and UP-TO-DATE - avoid suggesting outdated information
2. Make topics specific, actionable, and based on current trends
3. Focus on unique angles and innovative approaches
4. Your response MUST only contain the JSON object - no markdown, no explanations, no extra text
5. Ensure all JSON keys and string values are properly double-quoted
6. Do not use single quotes in your JSON
7. Do not include comments in the JSON
8. Verify your response is valid JSON before returning it
9. DO NOT mention players who are no longer on the Dallas Mavericks
`;

    console.log('Sending prompt to Groq...');

    // Generate completion with Groq
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama3-70b-8192",
    });

    // Get the response content
    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from Groq API');
    }

    console.log('Received response from Groq. Processing...\n');

    // Parse the JSON from the response
    const result = JSON.parse(content);

    // Display results
    console.log(`Generated ${result.topics.length} topic ideas:\n`);

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

  } catch (error) {
    console.error('Error testing ContentBot:', error);
    console.error(error.stack);
  }
}

// Run the test
testTopicGeneration();
