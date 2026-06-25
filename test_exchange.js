const clientId = '77y7f4k62yu4h4';
const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || 'PLACEHOLDER_SECRET';
const redirectUri = 'http://localhost:5175/';

// Replace this with a fresh authorization code from the URL
const code = 'AQRm8x76_hT8HoZGOd5k9Ih928VoW3YSiGU6A1IPvmRLg1uoRN_RpVTY01tCK_qW9eXfGqGfLsfpor8uOzeiaahycUzXybq-PKt9Y9vAgIqYRzPOeM_46QyZmpEYY4y8kJ2TL6U80Q9X1sMQY72L3-4z47QdsXLzcBmNzj8x1-rPPXNtj_pl6nA2NfEKDuA2wAua3p6oqdpOGO6G5L8';

async function testExchange() {
  const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
  
  console.log('Sending request to LinkedIn...');
  try {
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
        client_secret: clientSecret
      }).toString()
    });

    const status = response.status;
    const body = await response.text();
    console.log(`HTTP Status: ${status}`);
    console.log(`Response Body: ${body}`);
  } catch (err) {
    console.error('Error during fetch:', err);
  }
}

testExchange();
