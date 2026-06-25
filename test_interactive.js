import readline from 'readline';

const clientId = '77y7f4k62yu4h4';
const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || 'PLACEHOLDER_SECRET';
const redirectUri = 'http://localhost:5175/';

// PKCE Helpers
const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
let codeVerifier = '';
for (let i = 0; i < 64; i++) {
  codeVerifier += possible.charAt(Math.floor(Math.random() * possible.length));
}

// In Node, we can use crypto module to generate SHA256 base64url challenge
import crypto from 'crypto';
const hash = crypto.createHash('sha256').update(codeVerifier).digest();
const codeChallenge = hash.toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

const scope = 'w_member_social openid profile email';
const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=test_state&code_challenge=${codeChallenge}&code_challenge_method=S256`;

console.log('\n=========================================');
console.log('STEP 1: Open the following URL in your browser and authorize the app:');
console.log('=========================================');
console.log(authUrl);
console.log('=========================================\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('STEP 2: After redirecting back, paste the FULL redirected URL here (containing code=...): ', async (pasteUrl) => {
  rl.close();
  try {
    const urlObj = new URL(pasteUrl);
    const code = urlObj.searchParams.get('code');
    if (!code) {
      console.error('Error: Could not extract "code" parameter from the pasted URL.');
      return;
    }

    console.log(`\nExtracted code: ${code}`);
    console.log('Exchanging code for access token...');

    const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier
      }).toString()
    });

    const status = response.status;
    const body = await response.text();
    console.log(`\nHTTP Status: ${status}`);
    console.log(`Response Body: ${body}`);
  } catch (err) {
    console.error('Error during exchange:', err);
  }
});
