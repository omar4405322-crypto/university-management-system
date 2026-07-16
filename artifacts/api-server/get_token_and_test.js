import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import http from 'http';

const prisma = new PrismaClient();
const JWT_SECRET = 'my-super-secret-jwt-key-that-is-long-enough-32chars';

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

async function run() {
  try {
    const user = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });
    if (!user) {
      console.log('No SUPER_ADMIN found!');
      return;
    }
    
    const token = jwt.sign(
      { id: user.id, role: user.role, tokenVersion: user.tokenVersion },
      JWT_SECRET,
      { 
        expiresIn: '1h',
        issuer: 'Smart University Platform',
        audience: 'University Users'
      }
    );
    
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

    // 3. Find a doctor
    const doctor = await prisma.doctor.findFirst();
    
    // 3. POST new section
    console.log('\n--- POST /api/sections ---');
    const postData = JSON.stringify({
      courseId: 5,
      doctorId: doctor ? doctor.id : 1,
      name: 'Section Alpha'
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
    
  } catch(err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
