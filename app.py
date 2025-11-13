from flask import Flask, render_template, request, jsonify, send_file
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import json
import csv
import io
import time
from datetime import datetime
import re

app = Flask(__name__)

# Global variable to store scraping results
scraping_results = []
scraping_active = False

class WebScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.visited_urls = set()

    def scrape_url(self, url, scrape_type='text', max_depth=1, follow_links=False, current_depth=0):
        """Scrape a single URL"""
        global scraping_active

        if not scraping_active or current_depth >= max_depth:
            return []

        if url in self.visited_urls:
            return []

        results = []

        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            self.visited_urls.add(url)

            soup = BeautifulSoup(response.content, 'html.parser')

            result = {
                'url': url,
                'timestamp': datetime.now().isoformat(),
                'status_code': response.status_code,
                'depth': current_depth
            }

            if scrape_type == 'text':
                # Extract text content
                paragraphs = soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
                text_content = [p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)]
                result['content'] = text_content
                result['title'] = soup.title.string if soup.title else 'No Title'

            elif scrape_type == 'links':
                # Extract all links
                links = []
                for link in soup.find_all('a', href=True):
                    absolute_url = urljoin(url, link['href'])
                    links.append({
                        'text': link.get_text(strip=True),
                        'href': absolute_url
                    })
                result['links'] = links
                result['link_count'] = len(links)

            elif scrape_type == 'images':
                # Extract all images
                images = []
                for img in soup.find_all('img'):
                    img_url = urljoin(url, img.get('src', ''))
                    images.append({
                        'src': img_url,
                        'alt': img.get('alt', ''),
                        'title': img.get('title', '')
                    })
                result['images'] = images
                result['image_count'] = len(images)

            elif scrape_type == 'full':
                # Extract comprehensive data
                result['title'] = soup.title.string if soup.title else 'No Title'

                # Meta tags
                meta_tags = {}
                for meta in soup.find_all('meta'):
                    name = meta.get('name') or meta.get('property', '')
                    content = meta.get('content', '')
                    if name and content:
                        meta_tags[name] = content
                result['meta_tags'] = meta_tags

                # Text content
                paragraphs = soup.find_all(['p', 'h1', 'h2', 'h3'])
                result['text_snippets'] = [p.get_text(strip=True)[:200] for p in paragraphs[:10] if p.get_text(strip=True)]

                # Links
                links = [urljoin(url, a['href']) for a in soup.find_all('a', href=True)]
                result['links'] = links[:20]
                result['link_count'] = len(links)

                # Images
                images = [urljoin(url, img.get('src', '')) for img in soup.find_all('img')]
                result['images'] = images[:20]
                result['image_count'] = len(images)

            results.append(result)

            # Follow links if enabled
            if follow_links and current_depth < max_depth - 1:
                links = soup.find_all('a', href=True)
                for link in links[:5]:  # Limit to 5 links per page
                    if not scraping_active:
                        break
                    absolute_url = urljoin(url, link['href'])
                    # Only follow links from same domain
                    if urlparse(absolute_url).netloc == urlparse(url).netloc:
                        child_results = self.scrape_url(
                            absolute_url,
                            scrape_type,
                            max_depth,
                            follow_links,
                            current_depth + 1
                        )
                        results.extend(child_results)
                        time.sleep(0.5)  # Polite delay

        except requests.RequestException as e:
            results.append({
                'url': url,
                'error': str(e),
                'timestamp': datetime.now().isoformat(),
                'depth': current_depth
            })

        return results

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')

@app.route('/api/scrape', methods=['POST'])
def scrape():
    """Start scraping"""
    global scraping_results, scraping_active

    data = request.json
    url = data.get('url')
    scrape_type = data.get('scrape_type', 'text')
    max_depth = int(data.get('max_depth', 1))
    follow_links = data.get('follow_links', False)

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    # Validate URL
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    scraping_active = True
    scraping_results = []

    scraper = WebScraper()

    try:
        results = scraper.scrape_url(url, scrape_type, max_depth, follow_links)
        scraping_results = results

        return jsonify({
            'status': 'success',
            'results': results,
            'count': len(results),
            'visited_urls': len(scraper.visited_urls)
        })

    except Exception as e:
        scraping_active = False
        return jsonify({'error': str(e)}), 500

@app.route('/api/stop', methods=['POST'])
def stop_scraping():
    """Stop active scraping"""
    global scraping_active
    scraping_active = False
    return jsonify({'status': 'stopped'})

@app.route('/api/download/<format>', methods=['GET'])
def download(format):
    """Download scraped data in various formats"""
    global scraping_results

    if not scraping_results:
        return jsonify({'error': 'No data to download'}), 400

    if format == 'json':
        # Download as JSON
        json_data = json.dumps(scraping_results, indent=2, ensure_ascii=False)
        buffer = io.BytesIO(json_data.encode('utf-8'))
        buffer.seek(0)
        return send_file(
            buffer,
            mimetype='application/json',
            as_attachment=True,
            download_name=f'scraping_results_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        )

    elif format == 'txt':
        # Download as TXT
        txt_lines = []
        for item in scraping_results:
            txt_lines.append(f"URL: {item.get('url', 'N/A')}")
            txt_lines.append(f"Timestamp: {item.get('timestamp', 'N/A')}")
            txt_lines.append(f"Status: {item.get('status_code', 'N/A')}")

            if 'title' in item:
                txt_lines.append(f"Title: {item['title']}")

            if 'content' in item:
                txt_lines.append("Content:")
                for text in item['content'][:10]:
                    txt_lines.append(f"  - {text}")

            if 'links' in item:
                txt_lines.append(f"Links found: {len(item['links'])}")

            if 'images' in item:
                txt_lines.append(f"Images found: {len(item['images'])}")

            if 'error' in item:
                txt_lines.append(f"Error: {item['error']}")

            txt_lines.append("-" * 80)
            txt_lines.append("")

        txt_data = "\n".join(txt_lines)
        buffer = io.BytesIO(txt_data.encode('utf-8'))
        buffer.seek(0)
        return send_file(
            buffer,
            mimetype='text/plain',
            as_attachment=True,
            download_name=f'scraping_results_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'
        )

    elif format == 'csv':
        # Download as CSV
        output = io.StringIO()

        # Determine CSV columns based on data
        fieldnames = ['url', 'timestamp', 'status_code', 'depth', 'title', 'error']
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()

        for item in scraping_results:
            row = {
                'url': item.get('url', ''),
                'timestamp': item.get('timestamp', ''),
                'status_code': item.get('status_code', ''),
                'depth': item.get('depth', ''),
                'title': item.get('title', ''),
                'error': item.get('error', '')
            }
            writer.writerow(row)

        buffer = io.BytesIO(output.getvalue().encode('utf-8-sig'))  # UTF-8 BOM for Excel
        buffer.seek(0)
        return send_file(
            buffer,
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'scraping_results_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        )

    else:
        return jsonify({'error': 'Invalid format'}), 400

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
