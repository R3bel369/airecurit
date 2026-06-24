/**
 * Vercel Serverless Function: LinkedIn Token Exchange
 * 
 * Handles the OAuth 2.0 authorization code → access token exchange server-side.
 * This avoids CORS restrictions since the call is made from Node.js, not the browser.
 * 
 * POST /api/linkedin-token
 * Body: { code, redirect_uri, client_id, client_secret, code_verifier? }
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
    const { code, redirect_uri, client_id, client_secret, code_verifier } = req.body;

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

    if (code_verifier) {
      bodyParams.code_verifier = code_verifier;
    }

    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(bodyParams).toString()
    });

    const data = await tokenResponse.json();

    // Forward LinkedIn's response status and body
    return res.status(tokenResponse.status).json(data);
  } catch (err) {
    console.error('LinkedIn token exchange error:', err);
    return res.status(500).json({
      error: 'server_error',
      error_description: err.message || 'Internal server error during token exchange.'
    });
  }
}
