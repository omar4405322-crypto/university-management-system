# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Auth >> login with valid credentials returns accessToken
- Location: e2e\auth.spec.ts:6:8

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 429
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'; 
  2  |  import { loginAs, ACCOUNTS } from './helpers/auth'; 
  3  |  
  4  |  test.describe('Auth', () => { 
  5  |  
  6  |    test('login with valid credentials returns accessToken', async ({ request }) => { 
  7  |      const res = await request.post('/api/auth/login', { 
  8  |        data: ACCOUNTS.superAdmin, 
  9  |      }); 
  10 |      // Support both 200 (direct login) and 200 with requires2FA (if 2FA is enabled in seed)
> 11 |      expect(res.status()).toBe(200); 
     |                           ^ Error: expect(received).toBe(expected) // Object.is equality
  12 |      const body = await res.json(); 
  13 |      expect(body.success).toBe(true);
  14 |      
  15 |      if (body.requires2FA) {
  16 |        expect(body.message).toContain('2FA');
  17 |      } else {
  18 |        expect(body.data.accessToken).toBeTruthy(); 
  19 |        expect(body.data.user.role).toBe('SUPER_ADMIN'); 
  20 |      }
  21 |    }); 
  22 |  
  23 |    test('login with wrong password returns 401', async ({ request }) => { 
  24 |      const res = await request.post('/api/auth/login', { 
  25 |        data: { email: ACCOUNTS.superAdmin.email, password: 'wrongpassword' }, 
  26 |      }); 
  27 |      expect(res.status()).toBe(401); 
  28 |      const body = await res.json(); 
  29 |      expect(body.success).toBe(false); 
  30 |    }); 
  31 |  
  32 |    test('login with missing fields returns 422', async ({ request }) => { 
  33 |      const res = await request.post('/api/auth/login', { 
  34 |        data: { email: '' }, 
  35 |      }); 
  36 |      expect(res.status()).toBe(422); 
  37 |    }); 
  38 |  
  39 |    test('logout invalidates session', async ({ request }) => { 
  40 |      // We use student for this as superadmin has 2FA enabled in seed which complicates direct token retrieval
  41 |      const token = await loginAs(request, ACCOUNTS.student.email, ACCOUNTS.student.password); 
  42 |      const logoutRes = await request.post('/api/auth/logout', { 
  43 |        headers: { Authorization: `Bearer ${token}` }, 
  44 |      }); 
  45 |      expect(logoutRes.status()).toBe(200); 
  46 |    }); 
  47 |  
  48 |    test('unauthenticated request to protected route returns 401', async ({ request }) => { 
  49 |      const res = await request.get('/api/students'); 
  50 |      expect(res.status()).toBe(401); 
  51 |    }); 
  52 |  
  53 |    test('get /api/auth/me returns current user', async ({ request }) => { 
  54 |      const token = await loginAs(request, ACCOUNTS.student.email, ACCOUNTS.student.password); 
  55 |      const res = await request.get('/api/auth/me', { 
  56 |        headers: { Authorization: `Bearer ${token}` }, 
  57 |      }); 
  58 |      expect(res.status()).toBe(200); 
  59 |      const body = await res.json(); 
  60 |      expect(body.data.email).toBe(ACCOUNTS.student.email); 
  61 |    }); 
  62 |  
  63 |  }); 
  64 | 
```