/**
 * Zero-dependency Node.js CORS Proxy Server.
 * Runs on Node 18+ (utilizing native fetch).
 * Usage: node server/proxy.js
 */

import http from 'http';
import { URL } from 'url';

const PORT = process.env.PROXY_PORT || 3001;

// Hard-coded access token for local development proxy.
// The frontend no longer exposes a token input; the proxy injects it automatically.
const BACKEND_ACCESS_TOKEN = 'kqa0ZV51JpWd0KUf04LiLFQ5pIBT';

const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  // Handle preflight options request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse request URL
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  
  if (parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (parsedUrl.pathname !== '/proxy') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found. Use /proxy?url=<target_url>' }));
    return;
  }

  const targetUrl = parsedUrl.searchParams.get('url');

  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing "url" query parameter' }));
    return;
  }

  console.log(`[Proxy] Forwarding request to: ${targetUrl}`);

  try {
    // Build outgoing headers — inject the backend token so the
    // browser never needs to handle or expose it.
    const headers = {
      'Authorization': `Bearer ${BACKEND_ACCESS_TOKEN}`,
      'User-Agent': req.headers['user-agent'] || 'AP-Gap-Analyzer-Proxy/1.0',
      'Accept': req.headers['accept'] || '*/*'
    };
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }

    console.log(`[Proxy] Forwarding ${req.method} to: ${targetUrl}`);

    // Perform request to the target server
    const targetResponse = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      // Do not follow redirects automatically so the client sees them
      redirect: 'manual'
    });

    const contentType = targetResponse.headers.get('content-type') || 'application/json';
    const bodyText = await targetResponse.text();

    // Forward CORS-exposed response headers when available
    const responseHeaders = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    };
    const location = targetResponse.headers.get('location');
    if (location) {
      responseHeaders['Location'] = location;
    }

    res.writeHead(targetResponse.status, responseHeaders);
    res.end(bodyText);
    
    console.log(`[Proxy] Response: ${targetResponse.status} - ${contentType} (body: ${bodyText.length} chars)`);
  } catch (error) {
    console.error(`[Proxy Error] ${error.message}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy Request Failed', details: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`AP Gap Analyzer Local CORS Proxy running on port ${PORT}`);
  console.log(`To use: point your API URL to:`);
  console.log(`http://localhost:${PORT}/proxy?url=YOUR_ACTUAL_API_URL`);
  console.log(`==================================================`);
});
