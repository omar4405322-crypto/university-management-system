import http from 'http';

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data || '{}') });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTest() {
  try {
    // 1. Login
    const loginData = JSON.stringify({ email: 'superadmin@university.com', password: 'password123' });
    const loginRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, loginData);
    
    console.log('Login Status:', loginRes.status);
    if (!loginRes.body.token) {
        // Try admin
        console.log('Login failed, tried superadmin. Try another?');
        return;
    }
    const token = loginRes.body.token;

    // 2. Fetch sections
    console.log('\n--- GET /api/sections?courseId=5 ---');
    const getRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/sections?courseId=5',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log(`Status Code: ${getRes.status}`);
    console.log('JSON Body:', JSON.stringify(getRes.body, null, 2));

    // 3. POST new section
    console.log('\n--- POST /api/sections ---');
    const postData = JSON.stringify({
      courseId: 5,
      doctorId: 1, // Make sure doctor 1 exists
      name: 'Section A'
    });
    const postRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/sections',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);
    console.log(`Status Code: ${postRes.status}`);
    console.log('JSON Body:', JSON.stringify(postRes.body, null, 2));

  } catch (err) {
    console.error('Test script error:', err);
  }
}

runTest();
