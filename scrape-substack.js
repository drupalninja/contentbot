#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const readline = require('readline');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('query', {
    alias: 'q',
    description: 'Search query for Substack posts',
    type: 'string',
    demandOption: true
  })
  .option('max', {
    alias: 'm',
    description: 'Maximum number of posts to fetch',
    type: 'number',
    default: 5
  })
  .option('output', {
    alias: 'o',
    description: 'Output JSON file path',
    type: 'string',
    default: './output/substack-posts.json'
  })
  .option('publication', {
    alias: 'p',
    description: 'Specific Substack publication to fetch from (optional)',
    type: 'string'
  })
  .option('sort', {
    alias: 's',
    description: 'Sort method (recent, top, oldest)',
    type: 'string',
    default: 'recent',
    choices: ['recent', 'top', 'oldest']
  })
  .option('discover', {
    alias: 'd',
    description: 'Discover relevant Substack publications based on topic',
    type: 'boolean',
    default: false
  })
  .help()
  .alias('help', 'h')
  .argv;

/**
 * Provide a list of popular Substack publications as fallbacks.
 * @returns {Array} - Array of popular Substack publications
 */
function getPopularPublications() {
  return [
    {
      name: "The Generalist",
      subdomain: "thegeneralist",
      description: "The people, companies, and technologies shaping the future.",
      followers: 100000,
      url: "https://thegeneralist.substack.com",
      customDomain: null
    },
    {
      name: "Stratechery",
      subdomain: "stratechery",
      description: "Analysis of the strategy and business side of technology and media.",
      followers: 150000,
      url: "https://stratechery.com",
      customDomain: "stratechery.com"
    },
    {
      name: "Not Boring",
      subdomain: "notboring",
      description: "Business strategy and trends, but not boring.",
      followers: 120000,
      url: "https://www.notboring.co",
      customDomain: "www.notboring.co"
    },
    {
      name: "Lenny's Newsletter",
      subdomain: "lenny",
      description: "A weekly advice column about product, growth, working with humans, and anything else that's stressing you out about work.",
      followers: 130000,
      url: "https://www.lennysnewsletter.com",
      customDomain: "www.lennysnewsletter.com"
    },
    {
      name: "Platformer",
      subdomain: "platformer",
      description: "News and analysis on social networks and big tech companies.",
      followers: 110000,
      url: "https://www.platformer.news",
      customDomain: "www.platformer.news"
    },
    {
      name: "Slow Boring",
      subdomain: "slowboring",
      description: "Analysis of politics and policy.",
      followers: 95000,
      url: "https://www.slowboring.com",
      customDomain: "www.slowboring.com"
    },
    {
      name: "The Unpublishable",
      subdomain: "theunpublishable",
      description: "What the beauty industry won't tell you, from a reporter on a mission to reform it.",
      followers: 80000,
      url: "https://theunpublishable.substack.com",
      customDomain: null
    },
    {
      name: "The Profile",
      subdomain: "theprofile",
      description: "The most interesting stories on the internet. Profiles of fascinating people.",
      followers: 85000,
      url: "https://theprofile.substack.com",
      customDomain: null
    },
    {
      name: "Galaxy Brain",
      subdomain: "galaxybrain",
      description: "Charlie Warzel on technology, media, politics, and culture.",
      followers: 75000,
      url: "https://www.galxybrain.com",
      customDomain: "www.galxybrain.com"
    },
    {
      name: "Culture Study",
      subdomain: "annehelen",
      description: "Anne Helen Petersen on the culture of work, leisure, and parenthood.",
      followers: 90000,
      url: "https://annehelen.substack.com",
      customDomain: null
    }
  ];
}

/**
 * Discover relevant Substack publications based on a topic.
 * @param {string} topic - The topic to search for
 * @returns {Promise<Array>} - Array of Substack publications
 */
async function discoverSubstackPublications(topic) {
  console.log(`Discovering Substack publications related to "${topic}"...`);

  // Build the search URL for publications
  const searchUrl = `https://substack.com/api/v1/search/publications?term=${encodeURIComponent(topic)}&limit=10`;

  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    };

    https.get(searchUrl, options, (res) => {
      let data = '';

      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400) {
        console.log(`Redirected to ${res.headers.location}`);

        // Try alternative HTML scraping approach
        discoverPublicationsFromHTML(topic).then(publications => {
          if (publications.length > 0) {
            resolve(publications);
          } else {
            // Fall back to popular publications
            const popular = getPopularPublications();
            console.log(`Using a list of ${popular.length} popular Substack publications as fallback.`);
            resolve(popular);
          }
        }).catch(() => {
          // Fall back to popular publications
          const popular = getPopularPublications();
          console.log(`Using a list of ${popular.length} popular Substack publications as fallback.`);
          resolve(popular);
        });
        return;
      }

      // Handle error status codes
      if (res.statusCode !== 200) {
        console.error(`Received status code ${res.statusCode}`);

        // Try alternative HTML scraping approach
        discoverPublicationsFromHTML(topic).then(publications => {
          if (publications.length > 0) {
            resolve(publications);
          } else {
            // Fall back to popular publications
            const popular = getPopularPublications();
            console.log(`Using a list of ${popular.length} popular Substack publications as fallback.`);
            resolve(popular);
          }
        }).catch(() => {
          // Fall back to popular publications
          const popular = getPopularPublications();
          console.log(`Using a list of ${popular.length} popular Substack publications as fallback.`);
          resolve(popular);
        });
        return;
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);

          if (!jsonData || !jsonData.results) {
            console.log('No publications found or unexpected response format.');

            // Try alternative HTML scraping approach
            discoverPublicationsFromHTML(topic).then(publications => {
              if (publications.length > 0) {
                resolve(publications);
              } else {
                // Fall back to popular publications
                const popular = getPopularPublications();
                console.log(`Using a list of ${popular.length} popular Substack publications as fallback.`);
                resolve(popular);
              }
            }).catch(() => {
              // Fall back to popular publications
              const popular = getPopularPublications();
              console.log(`Using a list of ${popular.length} popular Substack publications as fallback.`);
              resolve(popular);
            });
            return;
          }

          const publications = jsonData.results.map(pub => ({
            name: pub.name || 'Unknown',
            subdomain: pub.subdomain || pub.hostname || null,
            description: pub.description || pub.snippet || '',
            followers: pub.followerCount || 0,
            url: `https://${pub.subdomain || pub.hostname}.substack.com`,
            customDomain: pub.customDomain || null
          }));

          console.log(`Found ${publications.length} Substack publications related to "${topic}".`);
          resolve(publications);
        } catch (error) {
          console.error('Error parsing Substack publication data:', error.message);

          // Try alternative HTML scraping approach
          discoverPublicationsFromHTML(topic).then(publications => {
            if (publications.length > 0) {
              resolve(publications);
            } else {
              // Fall back to popular publications
              const popular = getPopularPublications();
              console.log(`Using a list of ${popular.length} popular Substack publications as fallback.`);
              resolve(popular);
            }
          }).catch(() => {
            // Fall back to popular publications
            const popular = getPopularPublications();
            console.log(`Using a list of ${popular.length} popular Substack publications as fallback.`);
            resolve(popular);
          });
        }
      });
    }).on('error', (error) => {
      console.error('Error fetching Substack publications:', error.message);

      // Try alternative HTML scraping approach
      discoverPublicationsFromHTML(topic).then(publications => {
        if (publications.length > 0) {
          resolve(publications);
        } else {
          // Fall back to popular publications
          const popular = getPopularPublications();
          console.log(`Using a list of ${popular.length} popular Substack publications as fallback.`);
          resolve(popular);
        }
      }).catch(() => {
        // Fall back to popular publications
        const popular = getPopularPublications();
        console.log(`Using a list of ${popular.length} popular Substack publications as fallback.`);
        resolve(popular);
      });
    });
  });
}

/**
 * Alternative method to discover Substack publications by scraping HTML.
 * @param {string} topic - The topic to search for
 * @returns {Promise<Array>} - Array of Substack publications
 */
async function discoverPublicationsFromHTML(topic) {
  console.log(`Trying alternative method to discover Substack publications for "${topic}"...`);

  const searchUrl = `https://substack.com/search/publications/${encodeURIComponent(topic)}`;

  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    };

    https.get(searchUrl, options, (res) => {
      let data = '';

      if (res.statusCode !== 200) {
        console.error(`Received status code ${res.statusCode} from HTML page`);
        resolve([]);
        return;
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          // Extract initial state JSON from the HTML
          const jsonRegex = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s;
          const jsonMatch = data.match(jsonRegex);

          if (!jsonMatch || !jsonMatch[1]) {
            console.log('Could not extract Substack search data from HTML.');
            resolve([]);
            return;
          }

          const jsonData = JSON.parse(jsonMatch[1]);

          // Navigate to where the publications are likely to be stored
          let publications = [];
          if (jsonData.props?.pageProps?.searchResults?.publications?.items) {
            publications = jsonData.props.pageProps.searchResults.publications.items;
          } else if (jsonData.props?.pageProps?.dehydratedState?.queries) {
            // Try to find the search results in the dehydratedState
            const queries = jsonData.props.pageProps.dehydratedState.queries;
            for (const query of queries) {
              if (query.state?.data?.publications?.items) {
                publications = query.state.data.publications.items;
                break;
              }
            }
          }

          if (!publications || publications.length === 0) {
            console.log('No publications found in the Substack search results.');
            resolve([]);
            return;
          }

          // Format the publication data
          const formattedPublications = publications.map(pub => ({
            name: pub.name || pub.title || 'Unknown',
            subdomain: pub.subdomain || pub.hostname || null,
            description: pub.description || pub.snippet || '',
            followers: pub.followerCount || 0,
            url: `https://${pub.subdomain || pub.hostname}.substack.com`,
            customDomain: pub.customDomain || null
          }));

          console.log(`Found ${formattedPublications.length} Substack publications related to "${topic}" using HTML method.`);
          resolve(formattedPublications);
        } catch (error) {
          console.error('Error parsing Substack HTML data:', error.message);
          resolve([]);
        }
      });
    }).on('error', (error) => {
      console.error('Error fetching HTML Substack publications:', error.message);
      resolve([]);
    });
  });
}

/**
 * Interactive function to let user select a publication.
 * @param {Array} publications - Array of publication objects
 * @returns {Promise<string>} - Selected publication subdomain
 */
async function selectPublication(publications) {
  if (!publications || publications.length === 0) {
    console.log('No publications found to select from.');
    return null;
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\nAvailable Substack publications:');
    publications.forEach((pub, index) => {
      console.log(`${index + 1}. ${pub.name} (${pub.url})`);
      console.log(`   ${pub.description.substring(0, 100)}${pub.description.length > 100 ? '...' : ''}`);
      console.log(`   Followers: ${pub.followers}`);
      console.log('');
    });

    rl.question('Enter the number of the publication you want to search (or 0 to skip): ', (answer) => {
      const selection = parseInt(answer.trim());
      rl.close();

      if (isNaN(selection) || selection <= 0 || selection > publications.length) {
        console.log('No valid publication selected. Continuing without a specific publication.');
        resolve(null);
      } else {
        const selectedPub = publications[selection - 1];
        console.log(`Selected: ${selectedPub.name} (${selectedPub.subdomain})`);
        resolve(selectedPub.subdomain);
      }
    });
  });
}

/**
 * Fetch Substack posts from a specific publication.
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Array of Substack posts
 */
async function fetchSpecificSubstackPosts(options) {
  const { query, max, publication, customDomain, sort } = options;
  const limit = 12; // Substack API typically uses batches of 12

  // Map user-friendly sort options to Substack API sort parameters
  let apiSort = 'new';  // Default to new (most recent)
  if (sort === 'recent') {
    apiSort = 'new';
  } else if (sort === 'top') {
    apiSort = 'top';
  } else if (sort === 'oldest') {
    // The 'old' parameter causes errors with some publications, using 'new' as a safe default
    console.log("Note: 'oldest' sort option is not supported by all publications. Using 'recent' as fallback.");
    apiSort = 'new';
  }

  console.log(`Fetching up to ${max} Substack posts from "${publication}" related to "${query}" sorted by ${sort}...`);

  // Build the base URL for the publication
  const baseUrl = `https://${publication}.substack.com`;
  const apiUrl = `${baseUrl}/api/v1/archive?sort=${apiSort}&search=${encodeURIComponent(query)}&offset=0&limit=${max}`;

  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    };

    https.get(apiUrl, options, (res) => {
      let data = '';

      // Handle redirects to custom domains
      if (res.statusCode >= 300 && res.statusCode < 400) {
        const redirectUrl = res.headers.location;
        console.log(`Redirected to ${redirectUrl}`);

        // Try to follow the redirect if it's an API URL
        if (redirectUrl && redirectUrl.includes('/api/v1/archive')) {
          console.log('Following redirect to custom domain...');

          // Make a new request to the redirected URL
          https.get(redirectUrl, options, (redirectRes) => {
            let redirectData = '';

            if (redirectRes.statusCode !== 200) {
              console.error(`Received status code ${redirectRes.statusCode} from redirect`);
              resolve([]);
              return;
            }

            redirectRes.on('data', (chunk) => {
              redirectData += chunk;
            });

            redirectRes.on('end', () => {
              try {
                const jsonData = JSON.parse(redirectData);

                if (!jsonData || !Array.isArray(jsonData)) {
                  console.log('No posts found or unexpected response format from redirect.');
                  resolve([]);
                  return;
                }

                // Process the posts
                processAndFormatPosts(jsonData, query, max, publication, customDomain, resolve);
              } catch (error) {
                console.error('Error parsing Substack data from redirect:', error.message);
                resolve([]);
              }
            });
          }).on('error', (error) => {
            console.error('Error fetching redirected Substack posts:', error.message);
            resolve([]);
          });
          return;
        }

        resolve([]);
        return;
      }

      // Handle error status codes
      if (res.statusCode !== 200) {
        console.error(`Received status code ${res.statusCode}`);
        resolve([]);
        return;
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);

          if (!jsonData || !Array.isArray(jsonData)) {
            console.log('No posts found or unexpected response format.');
            resolve([]);
            return;
          }

          // Process the posts
          processAndFormatPosts(jsonData, query, max, publication, customDomain, resolve);
        } catch (error) {
          console.error('Error parsing Substack data:', error.message);
          resolve([]);
        }
      });
    }).on('error', (error) => {
      console.error('Error fetching Substack posts:', error.message);
      resolve([]);
    });
  });
}

/**
 * Process and format posts from JSON data.
 * @param {Array} jsonData - The raw JSON data from the API
 * @param {string} query - The search query
 * @param {number} max - Maximum number of posts
 * @param {string} publication - The publication name/subdomain
 * @param {string} customDomain - The publication custom domain (if any)
 * @param {Function} resolve - The Promise resolver function
 */
function processAndFormatPosts(jsonData, query, max, publication, customDomain, resolve) {
  // Filter posts that match the query if query is provided
  let posts = jsonData;
  if (query && query.trim() !== '') {
    const queryLower = query.toLowerCase();
    posts = posts.filter(post =>
      post.title.toLowerCase().includes(queryLower) ||
      (post.description && post.description.toLowerCase().includes(queryLower))
    );
  }

  // Limit the number of posts
  posts = posts.slice(0, max);

  // Get the correct domain to use for URLs
  const domain = customDomain || `${publication}.substack.com`;

  // Format the post data
  const formattedPosts = posts.map(post => {
    const baseUrl = `https://${domain}`;
    return {
      title: post.title,
      author: post.publishedBylines || post.byline || 'Unknown',
      publication: publication,
      subtitle: post.subtitle || '',
      description: post.description || '',
      url: post.canonical_url ?
        (post.canonical_url.startsWith('http') ? post.canonical_url : `${baseUrl}${post.canonical_url}`) :
        `${baseUrl}/p/${post.slug || ''}`,
      date: post.post_date,
      type: post.type,
      audience: post.audience || 'everyone',
      platform: 'Substack'
    };
  });

  console.log(`Found ${formattedPosts.length} Substack posts from ${publication}.`);
  resolve(formattedPosts);
}

/**
 * Fetch recent Substack posts for a query using global search.
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Array of Substack posts
 */
async function fetchGlobalSubstackPosts(options) {
  const { query, max, sort } = options;

  console.log(`Searching across all of Substack for up to ${max} posts about "${query}" sorted by ${sort}...`);

  // Build the HTML search URL - using the format users would use in a browser
  const searchUrl = `https://substack.com/search/${encodeURIComponent(query)}`;

  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    };

    https.get(searchUrl, options, (res) => {
      let data = '';

      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400) {
        console.log(`Redirected to ${res.headers.location}`);
        resolve([]);
        return;
      }

      // Handle error status codes
      if (res.statusCode !== 200) {
        console.error(`Received status code ${res.statusCode}`);
        resolve([]);
        return;
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          // Extract initial state JSON from the HTML
          const jsonRegex = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s;
          const jsonMatch = data.match(jsonRegex);

          if (!jsonMatch || !jsonMatch[1]) {
            console.log('Could not extract Substack search data from HTML.');
            resolve([]);
            return;
          }

          const jsonData = JSON.parse(jsonMatch[1]);

          // Navigate to where the posts are likely to be stored
          let posts = [];
          if (jsonData.props?.pageProps?.searchResults?.posts?.items) {
            posts = jsonData.props.pageProps.searchResults.posts.items;
          } else if (jsonData.props?.pageProps?.dehydratedState?.queries) {
            // Try to find the search results in the dehydratedState
            const queries = jsonData.props.pageProps.dehydratedState.queries;
            for (const query of queries) {
              if (query.state?.data?.posts?.items) {
                posts = query.state.data.posts.items;
                break;
              }
            }
          }

          if (!posts || posts.length === 0) {
            console.log('No posts found in the Substack search results.');
            resolve([]);
            return;
          }

          // Limit the number of posts
          posts = posts.slice(0, max);

          // Format the post data
          const formattedPosts = posts.map(post => {
            return {
              title: post.title || post.headline || 'Untitled',
              author: post.creator?.name || post.byline || 'Unknown',
              publication: post.publication?.name || post.hostName || post.hostname || 'Unknown',
              subtitle: post.subtitle || post.description || '',
              description: post.snippet || post.excerpt || '',
              url: post.fullUrl || post.url || `https://${post.hostname}.substack.com/p/${post.slug}`,
              date: post.publishedAt || post.postDate || 'Unknown',
              type: post.type || 'post',
              platform: 'Substack'
            };
          });

          console.log(`Found ${formattedPosts.length} Substack posts across all publications.`);
          resolve(formattedPosts);
        } catch (error) {
          console.error('Error parsing Substack global search data:', error.message);
          resolve([]);
        }
      });
    }).on('error', (error) => {
      console.error('Error fetching global Substack posts:', error.message);
      resolve([]);
    });
  });
}

/**
 * Write posts to a JSON file.
 * @param {Array} posts - Array of posts
 * @param {string} outputPath - Path to write the file to
 */
function writePostsToFile(posts, outputPath) {
  try {
    // Ensure the directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the posts to the file
    fs.writeFileSync(outputPath, JSON.stringify(posts, null, 2));
    console.log(`Substack posts saved to: ${outputPath}`);
  } catch (error) {
    console.error('Error writing to file:', error.message);
    throw error;
  }
}

/**
 * Main function to run the script.
 */
async function main() {
  try {
    const { query, max, output, publication, sort, discover } = argv;

    let selectedPublication = publication;
    let customDomain = null;

    // If discover flag is set, find relevant publications first
    if (discover) {
      const publications = await discoverSubstackPublications(query);
      if (publications.length > 0) {
        // Automatically select the first publication
        selectedPublication = publications[0].subdomain;
        customDomain = publications[0].customDomain;
        console.log(`Automatically selected: ${publications[0].name} (${selectedPublication})`);
      } else {
        console.log('No relevant publications found. Continuing with global search or specified publication.');
      }
    }
    // If we have a publication name but no custom domain info, check if it's in our list
    else if (selectedPublication && !customDomain) {
      // Check if it's one of our known publications with custom domains
      const popularPubs = getPopularPublications();
      const matchingPub = popularPubs.find(p => p.subdomain === selectedPublication);
      if (matchingPub && matchingPub.customDomain) {
        customDomain = matchingPub.customDomain;
        console.log(`Using custom domain ${customDomain} for ${selectedPublication}`);
      }
    }

    // Determine which search method to use
    let posts;
    if (selectedPublication) {
      // Search within a specific publication
      posts = await fetchSpecificSubstackPosts({
        query,
        max,
        publication: selectedPublication,
        customDomain,
        sort
      });
    } else {
      // Search across all of Substack
      posts = await fetchGlobalSubstackPosts({
        query,
        max,
        sort
      });
    }

    if (posts.length === 0) {
      console.log('No Substack posts found for the given query.');
      process.exit(0);
    }

    // Write posts to file
    writePostsToFile(posts, output);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
