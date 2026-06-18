const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function run() {
  let adminUser;
  try {
    // 1. Ensure we have a COLLEGE_ADMIN for college 1
    // Let's create or find a college admin
    const college1 = await prisma.college.upsert({
      where: { id: 1 },
      update: {},
      create: { name: 'Test College 1', nameAr: 'TC1' }
    });

    const email = 'collegeadmin_test@university.test';
    const password = 'AdminPassword123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    adminUser = await prisma.user.upsert({
      where: { email },
      update: { role: 'COLLEGE_ADMIN', managedCollegeId: college1.id },
      create: {
        email,
        password: hashedPassword,
        role: 'COLLEGE_ADMIN',
        managedCollegeId: college1.id,
        doctor: {
          create: { firstName: 'Test', lastName: 'Admin' }
        }
      }
    });

    // 2. Login to get token
    const loginRes = await axios.post('http://localhost:5002/api/auth/login', {
      email,
      password
    });
    const token = loginRes.data.data.accessToken;

    console.log('--- Test A: GET departments for wrong collegeId as COLLEGE_ADMIN ---');
    try {
      // Admin is for college 1, let's ask for college 2
      await axios.get('http://localhost:5002/api/departments?collegeId=2', {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.log(`Status: ${err.response?.status}`);
      console.log(`Response:`, err.response?.data);
    }

    console.log('\n--- Test B: POST createDepartment with missing collegeId ---');
    try {
      // Let's login as SUPER_ADMIN to avoid the automatic managedCollegeId override
      const saLogin = await axios.post('http://localhost:5002/api/auth/login', {
        email: 'admin@university.com',
        password: 'AdminPassword123!'
      });
      const saToken = saLogin.data.data.accessToken;

      await axios.post('http://localhost:5002/api/departments', {
        name: 'Test Dept',
        nameAr: 'Test Dept Ar'
        // Missing collegeId
      }, {
        headers: { Authorization: `Bearer ${saToken}` }
      });
    } catch (err) {
      console.log(`Status: ${err.response?.status}`);
      console.log(`Response:`, err.response?.data);
    }

  } catch (error) {
    console.error('Test script fatal error:', error.response?.data || error.message);
  } finally {
    if (adminUser) {
      await prisma.user.delete({ where: { id: adminUser.id } });
    }
    await prisma.$disconnect();
  }
}

run();
