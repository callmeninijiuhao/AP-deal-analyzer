/**
 * Resolves a dot-notation JSON path on an object.
 * e.g., "data.deals" on { data: { deals: [...] } }
 * @param {Object} obj - The target object.
 * @param {string} path - The dot-notation path.
 * @returns {*} The resolved value or undefined.
 */
function resolveJsonPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[key];
  }, obj);
}

/**
 * Normalizes deal objects to extract the deal ID string.
 * @param {any} deal - The deal object or string.
 * @returns {string|null}
 */
function extractDealId(deal) {
  if (!deal) return null;
  if (typeof deal === 'string' || typeof deal === 'number') {
    return String(deal).trim();
  }
  // Try common keys
  const idKeys = ['dealMetaId', 'deal_meta_id', 'deal_id', 'dealId', 'id', 'deal', 'ap_id', 'apId'];
  for (const key of idKeys) {
    if (deal[key] !== undefined && deal[key] !== null) {
      return String(deal[key]).trim();
    }
  }
  return null;
}

/**
 * Fetches deals for a single publisher.
 * @param {string} pubId - The publisher ID.
 * @param {Object} apiConfig - API configurations.
 * @returns {Promise<string[]>} List of deal IDs.
 */
/**
 * Checks if a token is expired based on the configured expiry date.
 * @param {string|null} expiryDate - ISO date string or null.
 * @returns {boolean}
 */
export function isTokenExpired(expiryDate) {
  if (!expiryDate) return false;
  return new Date() >= new Date(expiryDate);
}

/**
 * Returns human-readable days until token expiry.
 * @param {string|null} expiryDate
 * @returns {number|null} Days remaining, or null if no expiry set.
 */
export function getDaysUntilExpiry(expiryDate) {
  if (!expiryDate) return null;
  const diff = new Date(expiryDate) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Fetches deals for a single publisher.
 * @param {string} pubId - The publisher ID.
 * @param {Object} apiConfig - API configurations.
 * @returns {Promise<string[]>} List of deal IDs.
 */
/**
 * Checks whether the local CORS proxy is reachable.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function checkProxyHealth() {
  try {
    const res = await fetch('http://localhost:3001/health', { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (res.ok) return { ok: true };
    return { ok: false, error: `Proxy health returned HTTP ${res.status}` };
  } catch {
    return { ok: false, error: 'Local proxy is not running on port 3001. Start it with: npm run proxy' };
  }
}

/**
 * Returns mock deal data for demo/testing when real API is unavailable.
 * @param {string} pubId
 * @returns {string[]}
 */
function getMockDealsForPublisher(pubId) {
  // Deterministic mock: hash pubId to a subset of fake deals
  const allMockDeals = [
    'DEAL_1001', 'DEAL_1002', 'DEAL_1003', 'DEAL_1004', 'DEAL_1005',
    'DEAL_2001', 'DEAL_2002', 'DEAL_2003', 'DEAL_2004', 'DEAL_2005',
    'DEAL_3001', 'DEAL_3002', 'DEAL_3003', 'DEAL_3004', 'DEAL_3005'
  ];
  // Use char code sum to pick a subset deterministically
  const hash = pubId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const count = (hash % 8) + 1; // 1-8 deals
  const start = hash % allMockDeals.length;
  const deals = [];
  for (let i = 0; i < count; i++) {
    deals.push(allMockDeals[(start + i) % allMockDeals.length]);
  }
  return deals;
}

export async function fetchPublisherDeals(pubId, apiConfig) {
  // Demo mode: return mock data without hitting the network
  if (apiConfig.demoMode) {
    return getMockDealsForPublisher(pubId);
  }

  let url = apiConfig.baseUrl.replace('{pub_id}', encodeURIComponent(pubId));

  // Replace date placeholders if present
  if (apiConfig.fromDate) {
    url = url.replace('{from_date}', encodeURIComponent(apiConfig.fromDate));
  }
  if (apiConfig.toDate) {
    url = url.replace('{to_date}', encodeURIComponent(apiConfig.toDate));
  }

  // Auto-route through local proxy in development to bypass browser CORS locks
  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isDev) {
    const proxyHealth = await checkProxyHealth();
    if (!proxyHealth.ok) {
      throw new Error(proxyHealth.error);
    }
    url = `http://localhost:3001/proxy?url=${encodeURIComponent(url)}`;
  }
  
  const headers = {};
  if (apiConfig.authToken) {
    const auth = apiConfig.authToken.trim();
    headers['Authorization'] = /^bearer\s+/i.test(auth) ? auth : `Bearer ${auth}`;
  }

  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    let errorMsg = `HTTP ${response.status} ${response.statusText}`;
    try {
      const text = await response.text();
      try {
        const parsed = JSON.parse(text);
        const serverMsg = parsed.message || parsed.error || parsed.errorMessage || parsed.description || JSON.stringify(parsed);
        errorMsg += ` (${serverMsg})`;
      } catch {
        if (text && text.trim().length < 200) {
          errorMsg += ` (${text.trim()})`;
        }
      }
    } catch {
      // Ignore body read errors
    }

    // Provide actionable hints for common proxy / network errors
    if (errorMsg.includes('URL not allowed by proxy policy') || errorMsg.includes('not allowed')) {
      errorMsg += ' [Hint: Your network or a corporate proxy may be blocking this API URL. Try using a VPN, or check if your organization restricts outbound traffic.]';
    }
    if (response.status === 403) {
      errorMsg += ' [Hint: 403 usually means the token is invalid/expired, the IP is not allowlisted, or the endpoint requires different permissions.]';
    }
    if (response.status === 401) {
      errorMsg += ' [Hint: 401 means authentication failed. Check your token or try refreshing it.]';
    }

    throw new Error(errorMsg);
  }

  const json = await response.json();
  const rawDeals = resolveJsonPath(json, apiConfig.jsonPath);

  if (!rawDeals) {
    throw new Error(`Path "${apiConfig.jsonPath}" not found in response`);
  }

  if (!Array.isArray(rawDeals)) {
    throw new Error(`Expected an array at path "${apiConfig.jsonPath}", got ${typeof rawDeals}`);
  }

  // If the rows are arrays of values, zip them with json.columns if available
  const columns = json.columns || [];
  const normalizedDeals = (rawDeals.length > 0 && Array.isArray(rawDeals[0]))
    ? rawDeals.map(row => {
        const obj = {};
        columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      })
    : rawDeals;

  return normalizedDeals
    .map(extractDealId)
    .filter(id => id !== null);
}

/**
 * Attempts to refresh the Access Token using a user-provided refresh token.
 * @param {string} refreshToken
 * @returns {Promise<string>} The new Access Token.
 */
export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new Error('No refresh token provided. Please obtain a new access token manually.');
  }

  const targetUrl = 'https://api.pubmatic.com/v1/developer-integrations/developer/refreshToken';
  let url = targetUrl;

  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isDev) {
    url = `http://localhost:3001/proxy?url=${encodeURIComponent(targetUrl)}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed (HTTP ${response.status}): ${response.statusText}`);
  }

  const json = await response.json();
  const token = json.token || json.accessToken || json.access_token || (json.data && (json.data.token || json.data.accessToken || json.data.access_token));

  if (!token) {
    throw new Error('Access token not found in refresh response structure');
  }

  return token;
}

/**
 * Sequentially fetches deals for multiple publishers.
 * Supports cancellation and reporting progress.
 * @param {string[]} publishers - Array of publisher IDs.
 * @param {Object} apiConfig - API configuration settings.
 * @param {Object} controlSignal - Object with 'cancelled' property to stop execution.
 * @param {Function} onProgress - Callback: (pubId, status, details, resultDealsCount) => void
 * @returns {Promise<Record<string, string[]>>} Key: publisher ID, Value: array of deal IDs.
 */
export async function fetchAllPublishers({
  publishers,
  apiConfig,
  controlSignal,
  onProgress
}) {
  const monetizingMap = {};
  const delayMs = apiConfig.delayMs !== undefined ? apiConfig.delayMs : 200;
  const concurrency = apiConfig.concurrency !== undefined ? apiConfig.concurrency : 5;

  // Demo mode: simulate network delay but skip real requests
  if (apiConfig.demoMode) {
    for (let i = 0; i < publishers.length; i += concurrency) {
      if (controlSignal?.cancelled) break;
      const batch = publishers.slice(i, i + concurrency);
      await Promise.all(batch.map(async (pubId) => {
        if (controlSignal?.cancelled) return;
        onProgress(pubId, 'fetching', 'Fetching deals (demo mode)...', 0);
        await new Promise(r => setTimeout(r, 150));
        const deals = getMockDealsForPublisher(pubId);
        monetizingMap[pubId] = deals;
        onProgress(pubId, 'success', `✓ [DEMO] Fetched ${deals.length} deals`, deals.length);
      }));
      if (i + concurrency < publishers.length && !controlSignal?.cancelled && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    return monetizingMap;
  }

  // Process publishers in concurrent batches to speed up fetching
  for (let i = 0; i < publishers.length; i += concurrency) {
    if (controlSignal?.cancelled) {
      break;
    }

    const batch = publishers.slice(i, i + concurrency);

    const batchPromises = batch.map(async (pubId) => {
      if (controlSignal?.cancelled) return;

      onProgress(pubId, 'fetching', 'Fetching deals...', 0);

      try {
        const deals = await fetchPublisherDeals(pubId, apiConfig);
        monetizingMap[pubId] = deals;
        onProgress(pubId, 'success', `✓ Successfully fetched ${deals.length} deals`, deals.length);
      } catch (err) {
        monetizingMap[pubId] = []; // Empty array on failure
        let errMsg = err.message;
        if (errMsg === 'Failed to fetch' || errMsg === 'Load failed') {
          errMsg = 'Failed to fetch (Network error or server unreachable)';
        }
        onProgress(pubId, 'error', `✗ Failed: ${errMsg}`, 0);
      }
    });

    await Promise.all(batchPromises);

    // Short delay between batches to avoid hammering the API
    if (i + concurrency < publishers.length && !controlSignal?.cancelled && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return monetizingMap;
}
