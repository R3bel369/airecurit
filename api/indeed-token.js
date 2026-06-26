/**
 * Vercel Serverless Function: Indeed Token Exchange
 * 
 * Handles the OAuth 2.0 authorization code → access token exchange server-side.
 * This avoids CORS restrictions since the call is made from Node.js, not the browser.
 * 
 * POST /api/indeed-token
 * Body: { code, redirect_uri, client_id, client_secret }
 */
export default async function handler(req, res) {
  // CORS headers so the browser can call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, redirect_uri } = req.body;
    const client_id = req.body.client_id || process.env.INDEED_CLIENT_ID;
    const client_secret = req.body.client_secret || process.env.INDEED_CLIENT_SECRET;

    if (!code || !redirect_uri || !client_id || !client_secret) {
      return res.status(400).json({
        error: 'missing_params',
        error_description: 'code, redirect_uri, client_id, and client_secret are all required.'
      });
    }

    const bodyParams = {
      grant_type: 'authorization_code',
      code,
      redirect_uri,
      client_id,
      client_secret
    };

    const tokenResponse = await fetch('https://profile.indeed.com/oauth/v2/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams(bodyParams).toString()
    });

    const data = await tokenResponse.json();

    // Forward Indeed's response status and body
    return res.status(tokenResponse.status).json(data);
  } catch (err) {
    console.error('Indeed token exchange error:', err);
    return res.status(500).json({
      error: 'server_error',
      error_description: err.message || 'Internal server error during token exchange.'
    });
  }
}
