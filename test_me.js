const https = require('https');

async function main() {
  // 1. demo2 login
  const loginRes = await new Promise((resolve) => {
    const req = https.request({
      hostname: 'prismatic-app.vercel.app',
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({status: res.statusCode, cookies: res.headers['set-cookie'] || [], body: d}));
    });
    req.on('error', e => resolve({error: e.message}));
    req.write(JSON.stringify({email:'demo2@prismatic.app', password:'Prismatic2024!'}));
    req.end();
  });

  const rawCookie = (loginRes.cookies || []).find(c => c.includes('prismatic_token')) || '';
  const cookieValue = (rawCookie.match(/prismatic_token=([^;]+)/) || [])[1] || '';
  const loginBody = JSON.parse(loginRes.body || '{}');
  console.log('Step1 - login status:', loginRes.status);
  console.log('login user from body:', loginBody.user?.id, loginBody.user?.role);
  console.log('cookie value:', cookieValue.slice(0, 30) + '...');

  // 2. demo2 /api/auth/me
  const meRes = await new Promise((resolve) => {
    const req = https.request({
      hostname: 'prismatic-app.vercel.app',
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Cookie': 'prismatic_token=' + cookieValue }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({status: res.statusCode, body: d}));
    });
    req.on('error', e => resolve({error: e.message}));
    req.end();
  });

  console.log('\nStep2 - me status:', meRes.status);
  console.log('me raw body:', meRes.body);
  const meBody = JSON.parse(meRes.body || '{}');
  const user = meBody.user;
  console.log('user:', user ? 'exists' : 'NULL');
  if (user) {
    console.log('  id:', user.id);
    console.log('  role:', user.role);
    console.log('  plan:', user.plan);
    console.log('  credits:', user.credits);
  }
}

main().catch(console.error);
