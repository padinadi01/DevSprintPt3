const { execSync } = require('child_process');

async function main() {
  console.log('Obtaining JWT token for pemilik from live Cloud Run...');
  const loginOut = execSync('curl.exe -s -X POST https://student1-131481044262.asia-southeast1.run.app/api/auth/login -H "Content-Type: application/json" -d "{\\"username\\":\\"pemilik\\",\\"pin\\":\\"1234\\"}"').toString();
  const parsed = JSON.parse(loginOut);
  const token = parsed.token;
  console.log('Token acquired successfully. Logged in as:', parsed.user.name);

  // Check schema info
  const schemaInfoRaw = execSync('curl.exe -s https://student1-131481044262.asia-southeast1.run.app/api/schema-info').toString();
  console.log('\n--- LIVE DATABASE STATUS (/api/schema-info) ---');
  console.log(schemaInfoRaw);

  const tests = [
    { name: 'HTML (Landing /)', url: 'https://student1-131481044262.asia-southeast1.run.app/' },
    { name: 'HTML (/login)', url: 'https://student1-131481044262.asia-southeast1.run.app/login' },
    { name: 'HTML (/produk)', url: 'https://student1-131481044262.asia-southeast1.run.app/produk' },
    { name: 'JS Bundle (index)', url: 'https://student1-131481044262.asia-southeast1.run.app/assets/index-ylZeWZkK.js' },
    { name: 'JS Bundle (vendor-react)', url: 'https://student1-131481044262.asia-southeast1.run.app/assets/vendor-react-BgWlCQo0.js' },
    { name: 'POST /api/auth/login', url: 'https://student1-131481044262.asia-southeast1.run.app/api/auth/login', method: 'POST', body: '{"username":"pemilik","pin":"1234"}' },
    { name: 'GET /api/dashboard', url: 'https://student1-131481044262.asia-southeast1.run.app/api/dashboard', auth: true },
    { name: 'GET /api/products', url: 'https://student1-131481044262.asia-southeast1.run.app/api/products', auth: true },
    { name: 'POST /api/auth/users (Add user)', url: 'https://student1-131481044262.asia-southeast1.run.app/api/auth/users', method: 'POST', auth: true, body: () => JSON.stringify({ username: 'testuser' + Math.floor(Math.random() * 9000 + 1000), name: 'Test User', pin: '1234', role: 'STAF' }) }
  ];

  console.log('\n--- STEP 1 PRODUCTION CURL BENCHMARK (WARM INSTANCE) ---');
  console.log('-------------------------------------------------------------------------------------------------------------------');
  console.log('Endpoint / Resource              | Connect (TCP+TLS) | TTFB (Network+BE) | Backend Time (TTFB-Conn) | Total Time');
  console.log('-------------------------------------------------------------------------------------------------------------------');

  for (const t of tests) {
    let curlArgs = ['-s', '-o', 'NUL', '-w', 'connect: %{time_connect} ttfb: %{time_starttransfer} total: %{time_total}'];
    if (t.method === 'POST') {
      const bodyStr = typeof t.body === 'function' ? t.body() : t.body;
      curlArgs.push('-X', 'POST', '-H', 'Content-Type: application/json', '-d', bodyStr);
    }
    if (t.auth) {
      curlArgs.push('-H', `Authorization: Bearer ${token}`);
    }
    curlArgs.push(t.url);

    // Warm-up hit
    try {
      execSync(`curl.exe ${curlArgs.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`);
    } catch {}

    // Measured hit
    try {
      const output = execSync(`curl.exe ${curlArgs.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`).toString().trim();
      const match = output.match(/connect:\s*([\d.]+)\s*ttfb:\s*([\d.]+)\s*total:\s*([\d.]+)/);
      if (match) {
        const connect = (parseFloat(match[1]) * 1000).toFixed(1);
        const ttfb = (parseFloat(match[2]) * 1000).toFixed(1);
        const total = (parseFloat(match[3]) * 1000).toFixed(1);
        const backendTime = (parseFloat(match[2]) * 1000 - parseFloat(match[1]) * 1000).toFixed(1);
        console.log(`${t.name.padEnd(32)} | ${connect.padStart(15)} ms | ${ttfb.padStart(15)} ms | ${backendTime.padStart(22)} ms | ${total.padStart(8)} ms`);
      } else {
        console.log(`${t.name.padEnd(32)} | Output: ${output}`);
      }
    } catch (err) {
      console.error(`${t.name}: ${err.message}`);
    }
  }
  console.log('-------------------------------------------------------------------------------------------------------------------');
}

main().catch(console.error);
