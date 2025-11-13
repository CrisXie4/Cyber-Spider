# Cyber Spider - 网络爬虫系统

一个功能强大且具有赛博朋克风格UI的网络爬虫程序，支持多种爬取模式和数据导出格式。

## 功能特点

- **科技感UI设计**: 赛博朋克风格界面，炫酷动画效果
- **多种爬取模式**:
  - 文本内容提取
  - 链接提取
  - 图片提取
  - 完整页面信息
- **智能爬取**: 支持设置爬取深度和跟随链接
- **多格式导出**: 支持 JSON、TXT、CSV 三种格式下载
- **实时监控**: 实时显示爬取进度和日志
- **安全可靠**: 包含防XSS注入、请求超时等安全措施

## 项目结构

```
pachong/
├── server.js              # Node.js后端主程序
├── package.json           # Node.js依赖配置
├── views/
│   └── index.ejs         # EJS模板页面
└── public/
    ├── css/
    │   └── style.css     # 样式文件
    └── js/
        └── app.js        # 前端JavaScript
```

## 安装步骤

### 1. 安装Node.js依赖

```bash
npm install
```

或者使用 yarn：

```bash
yarn install
```

### 2. 运行程序

**生产模式：**
```bash
npm start
```

**开发模式（自动重启）：**
```bash
npm run dev
```

### 3. 访问应用

在浏览器中打开：`http://localhost:3000`

## 使用说明

### 基本操作

1. **输入目标URL**: 在"目标URL"输入框中输入要爬取的网址
2. **选择爬取类型**:
   - 文本内容: 提取页面中的段落和标题文字
   - 链接提取: 获取页面中所有的链接
   - 图片提取: 获取页面中所有的图片URL
   - 完整页面: 获取页面的综合信息（标题、meta标签、文本、链接、图片等）
3. **设置爬取深度**: 1-5层，控制爬虫的深度
4. **跟随链接**: 勾选后会跟随页面中的链接继续爬取（仅限同域名）
5. **启动爬虫**: 点击"启动爬虫"按钮开始爬取
6. **查看结果**: 在右侧面板查看实时日志和爬取结果
7. **下载数据**: 爬取完成后可选择JSON/TXT/CSV格式下载

### 功能按钮说明

- **启动爬虫**: 开始执行爬取任务
- **停止**: 中断正在运行的爬取任务
- **清空**: 清除所有结果和日志
- **下载JSON**: 将结果导出为JSON格式
- **下载TXT**: 将结果导出为文本格式
- **下载CSV**: 将结果导出为CSV表格格式

## 技术栈

- **后端**: Node.js + Express
- **爬虫**: Axios + Cheerio
- **模板引擎**: EJS
- **前端**: HTML5 + CSS3 + Vanilla JavaScript
- **UI设计**: 赛博朋克风格，响应式布局

## 高级配置

### 修改默认端口

在 `server.js` 文件的第6行修改：

```javascript
const PORT = 3000;  // 修改为你想要的端口号
```

### 调整爬取限制

在 `server.js` 中的 `WebScraper` 类中可以调整：

- 超时时间: `timeout: 10000` (第14行，单位毫秒)
- 每页跟随链接数: `$('a[href]').slice(0, 5)` (第141行)
- 请求延迟: `await this.sleep(500)` (第162行，单位毫秒)

### User-Agent配置

在 `server.js` 第15-17行修改请求头：

```javascript
headers: {
    'User-Agent': '你的User-Agent字符串'
}
```

## API接口说明

### POST /api/scrape

启动爬虫任务

**请求体：**
```json
{
  "url": "https://example.com",
  "scrape_type": "text",
  "max_depth": 1,
  "follow_links": false
}
```

**响应：**
```json
{
  "status": "success",
  "results": [...],
  "count": 10,
  "visited_urls": 5
}
```

### POST /api/stop

停止正在运行的爬虫任务

**响应：**
```json
{
  "status": "stopped"
}
```

### GET /api/download/:format

下载爬取结果

**参数：**
- format: `json` | `txt` | `csv`

## 注意事项

1. **遵守Robots协议**: 爬取网站前请查看目标网站的 robots.txt
2. **控制爬取频率**: 避免对目标网站造成过大压力
3. **版权和隐私**: 尊重网站版权，不要爬取私密信息
4. **网络安全**: 仅用于合法的数据采集和学习用途

## 常见问题

### Q: 为什么无法爬取某些网站？

A: 某些网站有反爬虫机制，可能需要：
- 添加更真实的请求头
- 使用代理IP
- 添加Cookie验证
- 处理JavaScript渲染的页面（需要Puppeteer等工具）

### Q: 如何爬取需要登录的网站？

A: 需要在代码中添加Cookie或Session处理，可以在 axios 配置中添加：

```javascript
headers: {
    'Cookie': '你的cookie字符串'
}
```

### Q: 爬取速度很慢怎么办？

A: 可以：
- 减少爬取深度
- 不勾选"跟随链接"
- 减少延迟时间（注意不要太频繁）
- 使用并发爬取（需要修改代码）

### Q: 如何处理跨域问题？

A: Node.js后端爬虫不会遇到浏览器的跨域限制，因为它是服务端请求。

## 依赖包说明

- **express**: Web应用框架
- **axios**: HTTP客户端，用于发送请求
- **cheerio**: 服务端jQuery实现，用于解析HTML
- **ejs**: 模板引擎
- **nodemon** (开发依赖): 自动重启服务器

## 开发计划

- [ ] 支持多线程/异步并发爬取
- [ ] 添加代理IP池
- [ ] 支持JavaScript渲染页面（Puppeteer）
- [ ] 添加定时任务功能
- [ ] MongoDB数据库存储支持
- [ ] 更多导出格式（Excel、PDF等）
- [ ] WebSocket实时推送进度
- [ ] 爬取任务队列管理

## 故障排除

### 端口已被占用

如果遇到 `EADDRINUSE` 错误，说明端口被占用：

**Windows:**
```bash
netstat -ano | findstr :3000
taskkill /PID <PID号> /F
```

**Linux/Mac:**
```bash
lsof -i :3000
kill -9 <PID号>
```

### 安装依赖失败

尝试清除缓存后重新安装：

```bash
npm cache clean --force
npm install
```

## 许可证

本项目仅供学习和研究使用，使用者需自行承担使用责任。

## 贡献

欢迎提交Issue和Pull Request！

---

**Cyber Spider v1.0** | Powered by Node.js & Express
