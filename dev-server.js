#!/usr/bin/env node
/**
 * 本地开发服务器
 * 提供静态文件服务，并代理API请求到wrangler dev
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = 8788; // 本地开发服务器端口
const WRANGLER_PORT = 8787; // wrangler dev 端口

// 启动 wrangler dev 作为后台进程
// 使用 --remote 模式避免本地网络连接限制（特别是在 WSL 环境下）
console.log('🚀 启动 Wrangler dev 服务器...');
const wrangler = spawn('npx', ['wrangler', 'dev', '--port', WRANGLER_PORT, '--remote'], {
    stdio: 'inherit',
    shell: true
});

wrangler.on('error', (err) => {
    console.error('❌ Wrangler 启动失败:', err);
    process.exit(1);
});

// 等待 wrangler 启动
setTimeout(() => {
    console.log(`✅ Wrangler dev 运行在 http://localhost:${WRANGLER_PORT}`);
    
    // 创建本地HTTP服务器
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;
        
        // 代理 API 请求到 wrangler dev
        if (pathname.startsWith('/api/')) {
            const proxyReq = http.request({
                hostname: 'localhost',
                port: WRANGLER_PORT,
                path: req.url,
                method: req.method,
                headers: req.headers
            }, (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
            });
            
            proxyReq.on('error', (err) => {
                console.error('代理请求错误:', err);
                res.writeHead(502, { 'Content-Type': 'text/plain' });
                res.end('无法连接到 Wrangler dev 服务器');
            });
            
            req.pipe(proxyReq);
            return;
        }
        
        // 处理静态文件
        let filePath = pathname === '/' ? '/binance-tracker.html' : pathname;
        filePath = path.join(PUBLIC_DIR, filePath);
        
        // 安全检查：确保文件在 public 目录内
        if (!filePath.startsWith(path.resolve(PUBLIC_DIR))) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }
        
        // 检查文件是否存在
        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found');
                return;
            }
            
            // 根据扩展名设置Content-Type
            const ext = path.extname(filePath);
            const contentTypes = {
                '.html': 'text/html',
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.svg': 'image/svg+xml'
            };
            
            const contentType = contentTypes[ext] || 'application/octet-stream';
            
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal server error');
                    return;
                }
                
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            });
        });
    });
    
    server.listen(PORT, () => {
        console.log(`\n✨ 本地开发服务器启动成功！`);
        console.log(`📁 静态文件目录: ${PUBLIC_DIR}`);
        console.log(`🔌 API代理: http://localhost:${WRANGLER_PORT}`);
        console.log(`\n🌐 访问地址: http://localhost:${PORT}`);
        console.log(`\n按 Ctrl+C 停止服务器\n`);
    });
    
    // 优雅关闭
    process.on('SIGINT', () => {
        console.log('\n\n正在关闭服务器...');
        wrangler.kill();
        server.close(() => {
            console.log('服务器已关闭');
            process.exit(0);
        });
    });
    
}, 3000); // 等待3秒让wrangler启动

