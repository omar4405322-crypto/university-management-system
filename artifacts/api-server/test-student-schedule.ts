import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true // needed if they use cookies, but usually we capture headers
});

async function main() {
  try {
    // 1. Login
    console.log('Logging in as student1.1@test.com...');
    const loginRes = await api.post('/auth/login', {
      email: 'student1.1@test.com',
      password: 'Password123!'
    });
    
    // We need to capture the cookie if auth uses httpOnly cookies, or token if returned in body.
    console.log(JSON.stringify(loginRes.data, null, 2));
    let token = loginRes.data.data?.token || loginRes.data.token || loginRes.data.data?.accessToken;
    const cookies = loginRes.headers['set-cookie'];
    
    // 2. Fetch Schedule
    console.log('\nFetching /schedules/week...');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (cookies) headers['Cookie'] = cookies.join('; ');

    const scheduleRes = await api.get('/schedules/week', { headers });
    
    console.log('--- RAW JSON RESPONSE ---');
    console.log(JSON.stringify(scheduleRes.data, null, 2));
    console.log('-------------------------');

  } catch (err: any) {
    if (err.response) {
      console.error('Error Status:', err.response.status);
      console.error('Error Data:', err.response.data);
    } else {
      console.error(err.message);
    }
  }
}

main();
