const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global state
let scrapingResults = [];
let scrapingActive = false;

// Web Scraper Class
class WebScraper {
    constructor() {
        this.visitedUrls = new Set();
        this.axiosConfig = {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };
    }

    async scrapeUrl(url, scrapeType = 'text', maxDepth = 1, followLinks = false, currentDepth = 0) {
        if (!scrapingActive || currentDepth >= maxDepth || this.visitedUrls.has(url)) {
            return [];
        }

        const results = [];

        try {
            const response = await axios.get(url, this.axiosConfig);
            this.visitedUrls.add(url);

            const $ = cheerio.load(response.data);

            const result = {
                url: url,
                timestamp: new Date().toISOString(),
                statusCode: response.status,
                depth: currentDepth
            };

            // Extract data based on scrape type
            switch (scrapeType) {
                case 'text':
                    result.title = $('title').text() || 'No Title';
                    result.content = [];
                    $('p, h1, h2, h3, h4, h5, h6').each((i, elem) => {
                        const text = $(elem).text().trim();
                        if (text) {
                            result.content.push(text);
                        }
                    });
                    break;

                case 'links':
                    result.links = [];
                    $('a[href]').each((i, elem) => {
                        const href = $(elem).attr('href');
                        const text = $(elem).text().trim();
                        const absoluteUrl = new URL(href, url).href;
                        result.links.push({
                            text: text,
                            href: absoluteUrl
                        });
                    });
                    result.linkCount = result.links.length;
                    break;

                case 'images':
                    result.images = [];
                    $('img').each((i, elem) => {
                        const src = $(elem).attr('src');
                        if (src) {
                            const absoluteUrl = new URL(src, url).href;
                            result.images.push({
                                src: absoluteUrl,
                                alt: $(elem).attr('alt') || '',
                                title: $(elem).attr('title') || ''
                            });
                        }
                    });
                    result.imageCount = result.images.length;
                    break;

                case 'full':
                    result.title = $('title').text() || 'No Title';

                    // Meta tags
                    result.metaTags = {};
                    $('meta').each((i, elem) => {
                        const name = $(elem).attr('name') || $(elem).attr('property') || '';
                        const content = $(elem).attr('content') || '';
                        if (name && content) {
                            result.metaTags[name] = content;
                        }
                    });

                    // Text snippets
                    result.textSnippets = [];
                    $('p, h1, h2, h3').slice(0, 10).each((i, elem) => {
                        const text = $(elem).text().trim();
                        if (text) {
                            result.textSnippets.push(text.substring(0, 200));
                        }
                    });

                    // Links
                    result.links = [];
                    $('a[href]').slice(0, 20).each((i, elem) => {
                        const href = $(elem).attr('href');
                        if (href) {
                            result.links.push(new URL(href, url).href);
                        }
                    });
                    result.linkCount = result.links.length;

                    // Images
                    result.images = [];
                    $('img').slice(0, 20).each((i, elem) => {
                        const src = $(elem).attr('src');
                        if (src) {
                            result.images.push(new URL(src, url).href);
                        }
                    });
                    result.imageCount = result.images.length;
                    break;
            }

            results.push(result);

            // Follow links if enabled
            if (followLinks && currentDepth < maxDepth - 1) {
                const links = [];
                $('a[href]').slice(0, 5).each((i, elem) => {
                    const href = $(elem).attr('href');
                    if (href) {
                        try {
                            const absoluteUrl = new URL(href, url).href;
                            const urlObj = new URL(absoluteUrl);
                            const baseUrlObj = new URL(url);

                            // Only follow links from same domain
                            if (urlObj.hostname === baseUrlObj.hostname) {
                                links.push(absoluteUrl);
                            }
                        } catch (e) {
                            // Invalid URL, skip
                        }
                    }
                });

                for (const link of links) {
                    if (!scrapingActive) break;
                    const childResults = await this.scrapeUrl(
                        link,
                        scrapeType,
                        maxDepth,
                        followLinks,
                        currentDepth + 1
                    );
                    results.push(...childResults);
                    await this.sleep(500); // Polite delay
                }
            }

        } catch (error) {
            results.push({
                url: url,
                error: error.message,
                timestamp: new Date().toISOString(),
                depth: currentDepth
            });
        }

        return results;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.post('/api/scrape', async (req, res) => {
    try {
        let { url, scrape_type, max_depth, follow_links } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Validate and fix URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        scrapingActive = true;
        scrapingResults = [];

        const scraper = new WebScraper();
        const results = await scraper.scrapeUrl(
            url,
            scrape_type || 'text',
            parseInt(max_depth) || 1,
            follow_links || false
        );

        scrapingResults = results;

        res.json({
            status: 'success',
            results: results,
            count: results.length,
            visited_urls: scraper.visitedUrls.size
        });

    } catch (error) {
        scrapingActive = false;
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/stop', (req, res) => {
    scrapingActive = false;
    res.json({ status: 'stopped' });
});

app.get('/api/download/:format', (req, res) => {
    const { format } = req.params;

    if (!scrapingResults || scrapingResults.length === 0) {
        return res.status(400).json({ error: 'No data to download' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `scraping_results_${timestamp}`;

    try {
        switch (format) {
            case 'json':
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
                res.send(JSON.stringify(scrapingResults, null, 2));
                break;

            case 'txt':
                let txtContent = '';
                scrapingResults.forEach(item => {
                    txtContent += `URL: ${item.url || 'N/A'}\n`;
                    txtContent += `Timestamp: ${item.timestamp || 'N/A'}\n`;
                    txtContent += `Status: ${item.statusCode || 'N/A'}\n`;

                    if (item.title) {
                        txtContent += `Title: ${item.title}\n`;
                    }

                    if (item.content && Array.isArray(item.content)) {
                        txtContent += 'Content:\n';
                        item.content.slice(0, 10).forEach(text => {
                            txtContent += `  - ${text}\n`;
                        });
                    }

                    if (item.links) {
                        txtContent += `Links found: ${Array.isArray(item.links) ? item.links.length : 0}\n`;
                    }

                    if (item.images) {
                        txtContent += `Images found: ${Array.isArray(item.images) ? item.images.length : 0}\n`;
                    }

                    if (item.error) {
                        txtContent += `Error: ${item.error}\n`;
                    }

                    txtContent += '-'.repeat(80) + '\n\n';
                });

                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}.txt"`);
                res.send(txtContent);
                break;

            case 'csv':
                const csvRows = [];
                csvRows.push('URL,Timestamp,Status Code,Depth,Title,Error');

                scrapingResults.forEach(item => {
                    const row = [
                        `"${(item.url || '').replace(/"/g, '""')}"`,
                        `"${(item.timestamp || '').replace(/"/g, '""')}"`,
                        item.statusCode || '',
                        item.depth || '',
                        `"${(item.title || '').replace(/"/g, '""')}"`,
                        `"${(item.error || '').replace(/"/g, '""')}"`
                    ];
                    csvRows.push(row.join(','));
                });

                const csvContent = '\uFEFF' + csvRows.join('\n'); // Add BOM for Excel

                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
                res.send(csvContent);
                break;

            default:
                res.status(400).json({ error: 'Invalid format' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🕷️  Cyber Spider Server running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
});

// Export for Vercel serverless
module.exports = app;
