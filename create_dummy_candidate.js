// Try to sign IN first (account may exist), then sign up if needed
const SUPABASE_URL = 'https://hqtpxaeuhsovwhevztzi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_LqxmEMuUaDLwfIAC0NshEA_RwTkK-f4';

const email = 'software3369@gmail.com';
const password = '123456';

async function trySignIn() {
  console.log(`\n1. Trying to sign in as: ${email}`);
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password })
  });
  const data = await resp.json();
  
  if (data.access_token) {
    console.log(`✅ Sign-in SUCCESS! Account exists and credentials are valid.`);
    console.log(`   Email: ${email}`);
    console.log(`   User ID: ${data.user?.id}`);
    return true;
  } else {
    console.log(`   Sign-in failed: ${data.error_description || data.msg || JSON.stringify(data)}`);
    return false;
  }
}

async function trySignUp() {
  console.log(`\n2. Trying to sign up: ${email}`);
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password })
  });
  const data = await resp.json();
  
  if (data.id || data.user?.id) {
    console.log(`✅ Sign-up SUCCESS!`);
    console.log(`   User ID: ${data.id || data.user?.id}`);
    if (data.access_token) {
      console.log(`   Auto-logged in (email confirmation disabled)`);
    } else {
      console.log(`   Email confirmation may be required`);
    }
    return true;
  } else {
    console.log(`   Sign-up result: ${JSON.stringify(data)}`);
    return false;
  }
}

async function main() {
  const signinOk = await trySignIn();
  if (!signinOk) {
    await trySignUp();
  }
  
  console.log(`\n📋 Summary:`);
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Role: Candidate (any email that is NOT admink338@gmail.com)`);
  console.log(`\n   Login at: http://localhost:5173`);
  console.log(`   1. Select "Candidate / Job Applicant" from dropdown`);
  console.log(`   2. Click "Sign In" tab`);
  console.log(`   3. Enter email and password above`);
}

main();
