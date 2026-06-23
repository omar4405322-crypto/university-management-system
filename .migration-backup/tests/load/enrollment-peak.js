import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },   // ramp up
    { duration: '3m', target: 500 },   // peak: 500 concurrent users
    { duration: '1m', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],    // less than 1% error rate
  },
};

export default function() {
  const loginRes = http.post(`${__ENV.BASE_URL}/api/auth/login`, JSON.stringify({
    email: `student${Math.floor(Math.random()*1000)}@test.com`,
    password: 'testpassword'
  }), { headers: { 'Content-Type': 'application/json' } });

  check(loginRes, { 'login success': r => r.status === 200 });
  
  if (loginRes.status === 200) {
    const token = loginRes.json('data.accessToken');
    const enrollRes = http.post(`${__ENV.BASE_URL}/api/enrollment`, 
      JSON.stringify({ courseId: 1 }), 
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    check(enrollRes, { 'enrollment ok': r => [200,201,409].includes(r.status) });
  }
  sleep(1);
}
