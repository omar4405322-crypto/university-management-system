import axios from 'axios';

async function testLogin() {
  try {
    const res = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@university.com',
      password: 'Admin123!',
    });
    console.log('Login success:', res.data);
  } catch (err) {
    console.error('Login failed:', err.response?.status, err.response?.data || err.message);
  }
}

testLogin();
