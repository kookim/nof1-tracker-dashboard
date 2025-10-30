
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

    if (!BINANCE_API_KEY || !BINANCE_SECRET_KEY) {
        return new Response(JSON.stringify({ error: 'API密钥未在环境中配置' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
    }

    const useTestnet = USE_TESTNET === 'true';
    const baseUrl = useTestnet ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com';
    
    const timestamp = Date.now();
    const recvWindow = 10000;
    
    const allParams = new URLSearchParams(queryParams);
    allParams.set('timestamp', timestamp);
    allParams.set('recvWindow', recvWindow);

    const queryString = allParams.toString();
    const signature = await generateSignature(queryString, BINANCE_SECRET_KEY);
    allParams.set('signature', signature);

    const url = `${baseUrl}${path}?${allParams.toString()}`;

    try {
        const response = await fetch(url, {
            headers: { 'X-MBX-APIKEY': BINANCE_API_KEY },
        });

        if (!response.ok) {
            const errorData = await response.json();
            return new Response(JSON.stringify({ error: `从币安API获取数据失败: ${response.statusText}`, details: errorData }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

        const data = await response.json();
        
        // Filter out 'PUMPUSDT' for positions and trades
        let responseData = data;
        if (path === '/fapi/v2/positionRisk') {
             responseData = data.filter(p => parseFloat(p.positionAmt) !== 0 && p.symbol !== 'PUMPUSDT');
        } else if (path === '/fapi/v1/userTrades') {
            responseData = data.filter(trade => trade.symbol !== 'PUMPUSDT').sort((a, b) => b.time - a.time).slice(0, parseInt(queryParams.limit) || 25);
        }

        return new Response(JSON.stringify(responseData), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: '请求币安API时发生网络错误', details: error.message }), {
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
