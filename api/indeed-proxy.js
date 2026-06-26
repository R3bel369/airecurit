/**
 * Vercel Serverless Function: Indeed API Proxy
 * 
 * Proxies GET/POST requests to api.indeed.com from the browser.
 * This avoids CORS restrictions since requests are dispatched server-side in Node.
 * 
 * GET/POST /api/indeed-proxy?path=<endpoint_path>
 */
export default async function handler(req, res) {
  // CORS Headers so the client-side app can access it
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const urlPath = req.query.path || '';
    if (!urlPath) {
      return res.status(400).json({
        error: 'missing_path',
        error_description: 'The query parameter "path" is required (e.g. ?path=v2/jobs).'
      });
    }

    const authHeader = req.headers.authorization;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (authHeader) headers.Authorization = authHeader;

    const fetchOptions = {
      method: req.method,
      headers
    };

    if (req.method === 'POST') {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const targetUrl = `https://api.indeed.com/${urlPath}`;
    console.log(`Indeed Proxy routing to: ${targetUrl}`);

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || '';
    const status = response.status;

    let responseBody;
    if (contentType.includes('application/json')) {
      responseBody = await response.json();
      return res.status(status).json(responseBody);
    } else {
      responseBody = await response.text();
      return res.status(status).send(responseBody);
    }
  } catch (err) {
    console.error('Indeed API proxy error:', err);
    return res.status(500).json({
      error: 'proxy_error',
      error_description: err.message || 'Internal server error inside Indeed API proxy.'
    });
  }
}
