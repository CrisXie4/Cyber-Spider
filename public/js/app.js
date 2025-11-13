// Global state
let scrapingActive = false;
let startTime = null;
let timerInterval = null;
let scrapedData = [];

// DOM elements
const urlInput = document.getElementById('url-input');
const scrapeType = document.getElementById('scrape-type');
const maxDepth = document.getElementById('max-depth');
const followLinks = document.getElementById('follow-links');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const clearBtn = document.getElementById('clear-btn');
const consoleDiv = document.getElementById('console');
const resultsContainer = document.getElementById('results-container');
const scrapedCount = document.getElementById('scraped-count');
const elapsedTime = document.getElementById('elapsed-time');
const systemStatus = document.getElementById('system-status');
const downloadJsonBtn = document.getElementById('download-json-btn');
const downloadTxtBtn = document.getElementById('download-txt-btn');
const downloadCsvBtn = document.getElementById('download-csv-btn');

// Event listeners
startBtn.addEventListener('click', startScraping);
stopBtn.addEventListener('click', stopScraping);
clearBtn.addEventListener('click', clearResults);
downloadJsonBtn.addEventListener('click', () => downloadData('json'));
downloadTxtBtn.addEventListener('click', () => downloadData('txt'));
downloadCsvBtn.addEventListener('click', () => downloadData('csv'));

// Add log to console
function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = document.createElement('div');
    logLine.className = `console-line ${type}`;
    logLine.innerHTML = `
        <span class="timestamp">[${timestamp}]</span>
        <span class="message">${message}</span>
    `;
    consoleDiv.appendChild(logLine);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

// Update timer
function updateTimer() {
    if (startTime) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        elapsedTime.textContent = `${elapsed}s`;
    }
}

// Start scraping
async function startScraping() {
    const url = urlInput.value.trim();

    if (!url) {
        addLog('请输入有效的URL', 'error');
        return;
    }

    scrapingActive = true;
    startTime = Date.now();

    // Update UI
    startBtn.disabled = true;
    stopBtn.disabled = false;
    urlInput.disabled = true;
    scrapeType.disabled = true;
    maxDepth.disabled = true;
    followLinks.disabled = true;
    systemStatus.textContent = '爬取中...';
    systemStatus.style.color = 'var(--accent-color)';

    // Start timer
    timerInterval = setInterval(updateTimer, 1000);

    addLog(`开始爬取: ${url}`, 'info');
    addLog(`爬取类型: ${scrapeType.options[scrapeType.selectedIndex].text}`, 'info');
    addLog(`爬取深度: ${maxDepth.value}`, 'info');
    addLog(`跟随链接: ${followLinks.checked ? '是' : '否'}`, 'info');

    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                scrape_type: scrapeType.value,
                max_depth: parseInt(maxDepth.value),
                follow_links: followLinks.checked
            })
        });

        const data = await response.json();

        if (response.ok) {
            scrapedData = data.results;
            displayResults(data.results);
            addLog(`爬取完成! 共访问 ${data.visited_urls} 个URL，获取 ${data.count} 条结果`, 'info');

            // Enable download buttons
            downloadJsonBtn.disabled = false;
            downloadTxtBtn.disabled = false;
            downloadCsvBtn.disabled = false;
        } else {
            addLog(`错误: ${data.error}`, 'error');
        }

    } catch (error) {
        addLog(`请求失败: ${error.message}`, 'error');
    } finally {
        resetScrapingState();
    }
}

// Stop scraping
async function stopScraping() {
    try {
        await fetch('/api/stop', { method: 'POST' });
        addLog('爬取已停止', 'warning');
        resetScrapingState();
    } catch (error) {
        addLog(`停止失败: ${error.message}`, 'error');
    }
}

// Reset scraping state
function resetScrapingState() {
    scrapingActive = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    urlInput.disabled = false;
    scrapeType.disabled = false;
    maxDepth.disabled = false;
    followLinks.disabled = false;
    systemStatus.textContent = '系统就绪';
    systemStatus.style.color = '';

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Display results
function displayResults(results) {
    resultsContainer.innerHTML = '';
    scrapedCount.textContent = results.length;

    results.forEach((result, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';

        let contentHtml = '';

        if (result.error) {
            contentHtml = `
                <div class="result-title">错误</div>
                <div class="result-url">${escapeHtml(result.url)}</div>
                <div class="result-content" style="color: var(--danger-color);">
                    ${escapeHtml(result.error)}
                </div>
            `;
        } else {
            contentHtml = `
                <div class="result-title">${escapeHtml(result.title || `结果 #${index + 1}`)}</div>
                <div class="result-url">${escapeHtml(result.url)}</div>
                <div class="result-content">
                    ${formatResultContent(result)}
                </div>
            `;
        }

        resultItem.innerHTML = contentHtml;
        resultsContainer.appendChild(resultItem);
    });
}

// Format result content based on type
function formatResultContent(result) {
    let html = '';

    if (result.status_code) {
        html += `<div><strong>状态码:</strong> ${result.status_code}</div>`;
    }

    if (result.depth !== undefined) {
        html += `<div><strong>深度:</strong> ${result.depth}</div>`;
    }

    if (result.content && Array.isArray(result.content)) {
        html += `<div><strong>文本内容:</strong></div>`;
        html += '<ul style="margin-left: 20px; margin-top: 5px;">';
        result.content.slice(0, 5).forEach(text => {
            html += `<li>${escapeHtml(text.substring(0, 150))}${text.length > 150 ? '...' : ''}</li>`;
        });
        html += '</ul>';
        if (result.content.length > 5) {
            html += `<div style="color: var(--text-secondary); font-size: 0.85rem;">...及其他 ${result.content.length - 5} 项</div>`;
        }
    }

    if (result.links && Array.isArray(result.links)) {
        if (result.link_count) {
            html += `<div><strong>链接数量:</strong> ${result.link_count}</div>`;
        }
        html += '<div><strong>链接示例:</strong></div>';
        html += '<ul style="margin-left: 20px; margin-top: 5px;">';
        const displayLinks = Array.isArray(result.links[0]) ? result.links : result.links.slice(0, 5);
        displayLinks.slice(0, 5).forEach(link => {
            if (typeof link === 'string') {
                html += `<li><a href="${escapeHtml(link)}" target="_blank" style="color: var(--primary-color);">${escapeHtml(link.substring(0, 80))}</a></li>`;
            } else {
                html += `<li><a href="${escapeHtml(link.href)}" target="_blank" style="color: var(--primary-color);">${escapeHtml(link.text || link.href.substring(0, 80))}</a></li>`;
            }
        });
        html += '</ul>';
    }

    if (result.images && Array.isArray(result.images)) {
        if (result.image_count) {
            html += `<div><strong>图片数量:</strong> ${result.image_count}</div>`;
        }
        html += '<div><strong>图片示例:</strong></div>';
        html += '<ul style="margin-left: 20px; margin-top: 5px;">';
        const displayImages = Array.isArray(result.images[0]) ? result.images : result.images.slice(0, 3);
        displayImages.slice(0, 3).forEach(img => {
            if (typeof img === 'string') {
                html += `<li><a href="${escapeHtml(img)}" target="_blank" style="color: var(--primary-color);">${escapeHtml(img.substring(0, 80))}</a></li>`;
            } else {
                html += `<li><a href="${escapeHtml(img.src)}" target="_blank" style="color: var(--primary-color);">${escapeHtml(img.alt || img.src.substring(0, 80))}</a></li>`;
            }
        });
        html += '</ul>';
    }

    if (result.text_snippets && Array.isArray(result.text_snippets)) {
        html += '<div><strong>文本片段:</strong></div>';
        html += '<ul style="margin-left: 20px; margin-top: 5px;">';
        result.text_snippets.slice(0, 3).forEach(snippet => {
            html += `<li>${escapeHtml(snippet)}</li>`;
        });
        html += '</ul>';
    }

    if (result.meta_tags && typeof result.meta_tags === 'object') {
        const importantMeta = ['description', 'keywords', 'author'];
        const metaToShow = Object.entries(result.meta_tags)
            .filter(([key]) => importantMeta.includes(key))
            .slice(0, 3);

        if (metaToShow.length > 0) {
            html += '<div><strong>Meta标签:</strong></div>';
            html += '<ul style="margin-left: 20px; margin-top: 5px;">';
            metaToShow.forEach(([key, value]) => {
                html += `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value.substring(0, 100))}</li>`;
            });
            html += '</ul>';
        }
    }

    return html || '<div>无内容</div>';
}

// Clear results
function clearResults() {
    resultsContainer.innerHTML = '';
    consoleDiv.innerHTML = `
        <div class="console-line welcome">
            <span class="timestamp">[SYSTEM]</span>
            <span class="message">欢迎使用 Cyber Spider 爬虫系统</span>
        </div>
    `;
    scrapedCount.textContent = '0';
    elapsedTime.textContent = '0s';
    scrapedData = [];

    // Disable download buttons
    downloadJsonBtn.disabled = true;
    downloadTxtBtn.disabled = true;
    downloadCsvBtn.disabled = true;

    addLog('结果已清空', 'info');
}

// Download data
async function downloadData(format) {
    if (scrapedData.length === 0) {
        addLog('没有可下载的数据', 'warning');
        return;
    }

    try {
        addLog(`正在下载 ${format.toUpperCase()} 格式...`, 'info');

        const response = await fetch(`/api/download/${format}`);

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Get filename from Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `scraping_results.${format}`;

            if (contentDisposition) {
                const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match && match[1]) {
                    filename = match[1].replace(/['"]/g, '');
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            addLog(`下载完成: ${filename}`, 'info');
        } else {
            const error = await response.json();
            addLog(`下载失败: ${error.error}`, 'error');
        }
    } catch (error) {
        addLog(`下载错误: ${error.message}`, 'error');
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
addLog('系统初始化完成', 'info');
addLog('请输入目标URL并选择爬取选项', 'info');
