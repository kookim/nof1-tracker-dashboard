
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

// Helper function to generate HMAC-SHA256 signature using Web Crypto API
async function generateSignature(queryString, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
    // Convert ArrayBuffer to hex string
    return Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generic function to handle Binance API requests
async function handleBinanceRequest(path, queryParams, env) {
    const { BINANCE_API_KEY, BINANCE_SECRET_KEY, USE_TESTNET } = env;

    console.log(`[${new Date().toISOString()}] 处理币安API请求: ${path}`);
    console.log(`[${new Date().toISOString()}] 查询参数:`, queryParams);

    if (!BINANCE_API_KEY || !BINANCE_SECRET_KEY) {
        console.error(`[${new Date().toISOString()}] ❌ API密钥未配置 - BINANCE_API_KEY: ${!!BINANCE_API_KEY}, BINANCE_SECRET_KEY: ${!!BINANCE_SECRET_KEY}`);
        return new Response(JSON.stringify({ error: 'API密钥未在环境中配置' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
    }

    console.log(`[${new Date().toISOString()}] ✅ API密钥已配置`);
    console.log(`[${new Date().toISOString()}] API Key (前10字符): ${BINANCE_API_KEY.substring(0, 10)}...`);

    const useTestnet = USE_TESTNET === 'true';
    const baseUrl = useTestnet ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com';
    
    console.log(`[${new Date().toISOString()}] 使用${useTestnet ? '测试网' : '主网'}: ${baseUrl}`);
    
    const timestamp = Date.now();
    const recvWindow = 10000;
    
    // 币安API要求参数按字母顺序排序
    // 将所有参数合并到一个对象中
    const allParamsObj = {
        ...Object.fromEntries(new URLSearchParams(queryParams)),
        timestamp: timestamp.toString(),
        recvWindow: recvWindow.toString()
    };
    
    // 按字母顺序排序参数并构建查询字符串（签名前）
    const queryString = Object.keys(allParamsObj)
        .sort()
        .map(key => `${key}=${encodeURIComponent(allParamsObj[key])}`)
        .join('&');
    
    // 生成签名
    const signature = await generateSignature(queryString, BINANCE_SECRET_KEY);
    
    // 构建最终URL（包含签名）
    const url = `${baseUrl}${path}?${queryString}&signature=${signature}`;
    console.log(`[${new Date().toISOString()}] 请求URL: ${baseUrl}${path}`);
    console.log(`[${new Date().toISOString()}] 时间戳: ${timestamp}, 接收窗口: ${recvWindow}`);
    console.log(`[${new Date().toISOString()}] 查询字符串 (签名前): ${queryString}`);
    console.log(`[${new Date().toISOString()}] 签名: ${signature.substring(0, 20)}...`);

    try {
        console.log(`[${new Date().toISOString()}] 发送请求到币安API...`);
        console.log(`[${new Date().toISOString()}] 完整URL (隐藏签名): ${url.split('&signature=')[0]}...`);
        
        let response;
        try {
            response = await fetch(url, {
            headers: { 'X-MBX-APIKEY': BINANCE_API_KEY },
        });
        } catch (fetchError) {
            console.error(`[${new Date().toISOString()}] ❌ Fetch调用失败:`, fetchError);
            console.error(`[${new Date().toISOString()}] 错误类型: ${fetchError.constructor.name}`);
            console.error(`[${new Date().toISOString()}] 错误消息: ${fetchError.message}`);
            throw fetchError;
        }

        console.log(`[${new Date().toISOString()}] 响应状态: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            let errorData;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    errorData = await response.json();
                } catch (e) {
                    const text = await response.text();
                    errorData = { raw: text, parseError: e.message };
                }
            } else {
                const text = await response.text();
                errorData = { raw: text };
            }
            
            console.error(`[${new Date().toISOString()}] ❌ 币安API错误响应:`, JSON.stringify(errorData, null, 2));
            console.error(`[${new Date().toISOString()}] 错误详情:`, {
                status: response.status,
                statusText: response.statusText,
                url: url.replace(/\?.*/, '?...'), // 隐藏查询参数
                headers: Object.fromEntries(response.headers.entries())
            });
            
            return new Response(JSON.stringify({ 
                error: `从币安API获取数据失败: ${response.statusText}`, 
                status: response.status,
                details: errorData 
            }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

        const data = await response.json();
        console.log(`[${new Date().toISOString()}] ✅ 成功获取数据, 数据条数: ${Array.isArray(data) ? data.length : 'N/A'}`);
        
        // Filter out 'PUMPUSDT' for positions and trades
        let responseData = data;
        if (path === '/fapi/v2/positionRisk') {
             const originalLength = data.length;
             responseData = data.filter(p => parseFloat(p.positionAmt) !== 0 && p.symbol !== 'PUMPUSDT');
             console.log(`[${new Date().toISOString()}] 过滤仓位数据: ${originalLength} -> ${responseData.length}`);
        } else if (path === '/fapi/v1/userTrades') {
            const originalLength = data.length;
            responseData = data.filter(trade => trade.symbol !== 'PUMPUSDT').sort((a, b) => b.time - a.time).slice(0, parseInt(queryParams.limit) || 25);
            console.log(`[${new Date().toISOString()}] 过滤交易数据: ${originalLength} -> ${responseData.length}`);
        }

        return new Response(JSON.stringify(responseData), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });

    } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ 请求币安API时发生网络错误:`, error);
        console.error(`[${new Date().toISOString()}] 错误堆栈:`, error.stack);
        console.error(`[${new Date().toISOString()}] 请求URL: ${url.replace(/\?.*/, '?...')}`);
        
        return new Response(JSON.stringify({ 
            error: '请求币安API时发生网络错误', 
            details: error.message,
            stack: error.stack 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
    }
}


export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const { pathname, searchParams } = url;

        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
            });
        }

        // API routes
        if (pathname.startsWith('/api/')) {
            switch (pathname) {
                case '/api/account':
                    return handleBinanceRequest('/fapi/v2/account', {}, env);
                case '/api/positions':
                    return handleBinanceRequest('/fapi/v2/positionRisk', {}, env);
                case '/api/trades':
                     const limit = searchParams.get('limit') || '25';
                     // Fetch more to filter on the server side
                     const requestLimit = parseInt(limit) <= 100 ? 100 : parseInt(limit);
                    return handleBinanceRequest('/fapi/v1/userTrades', { limit: requestLimit.toString() }, env);
                case '/api/config':
                    const hasConfig = !!(env.BINANCE_API_KEY && env.BINANCE_SECRET_KEY);
                    return new Response(JSON.stringify({ hasConfig, useTestnet: env.USE_TESTNET === 'true' }), {
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    });
                default:
                    return new Response('API endpoint not found', { status: 404 });
            }
        }

        // Serve static assets from the "public" directory
        // Use the new [assets] binding (recommended) or fall back to [site] KV assets
        
        // Method 1: Try new [assets] binding (simpler, recommended)
        // Note: ASSETS binding is automatically created by Cloudflare when [assets] is configured
        if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
            try {
                // Handle root path - redirect to binance-tracker.html
                if (pathname === '/') {
                    const indexPath = new URL('/binance-tracker.html', request.url);
                    return await env.ASSETS.fetch(new Request(indexPath.toString(), request));
                }
                // For all other paths, use assets binding
                return await env.ASSETS.fetch(request);
            } catch (assetError) {
                // If ASSETS.fetch fails, log and try fallback methods
                console.error('ASSETS.fetch error:', assetError.message);
                // Fall through to try other methods
            }
        }
        
        // Method 2: Fall back to [site] KV assets (legacy method)
        if (env.__STATIC_CONTENT && env.__STATIC_CONTENT_MANIFEST) {
            try {
                // A little hack to serve index.html for the root path
                if (pathname === '/') {
                    url.pathname = '/binance-tracker.html';
                }
                
                const asset = await getAssetFromKV({
                    request: new Request(url.toString(), request),
                    waitUntil: ctx.waitUntil.bind(ctx),
                }, {
                    ASSET_NAMESPACE: env.__STATIC_CONTENT,
                    ASSET_MANIFEST: JSON.parse(env.__STATIC_CONTENT_MANIFEST),
                });
                
                return asset;
            } catch (e) {
                // If getAssetFromKV throws an error, return 404
                return new Response(`Asset not found: ${pathname}\nError: ${e.message}`, { 
                    status: 404,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            }
        }
        
        // Neither method available - configuration error
        // This usually means [assets] or [site] configuration wasn't properly deployed
        const availableEnvKeys = Object.keys(env).filter(k => 
            k.includes('ASSET') || k.includes('STATIC') || k === 'ASSETS'
        );
        
        return new Response(
            `Static assets not configured.\n\n` +
            `Debug info:\n` +
            `- Has ASSETS binding: ${!!env.ASSETS}\n` +
            `- Has __STATIC_CONTENT: ${!!env.__STATIC_CONTENT}\n` +
            `- Has __STATIC_CONTENT_MANIFEST: ${!!env.__STATIC_CONTENT_MANIFEST}\n` +
            `- Related env keys: ${availableEnvKeys.length > 0 ? availableEnvKeys.join(', ') : 'none'}\n\n` +
            `Please ensure:\n` +
            `1. wrangler.toml includes [assets] directory configuration\n` +
            `2. The deployment includes static assets (use 'wrangler deploy' command)\n` +
            `3. If using Cloudflare Dashboard Git integration, ensure it uses 'wrangler deploy'\n\n` +
            `Requested: ${pathname}\n` +
            `Note: ASSETS binding is auto-created - no manual environment variable needed.`,
            { 
                status: 503,
                headers: { 
                    'Content-Type': 'text/plain; charset=utf-8',
                }
            }
        );
    },
};
