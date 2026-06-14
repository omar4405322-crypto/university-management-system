# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rbac.spec.ts >> RBAC — Search >> SUPER_ADMIN can see all search results
- Location: e2e\rbac.spec.ts:17:8

# Error details

```
TypeError: Cannot read properties of undefined (reading 'accessToken')
```

# Test source

```ts
  1  | import { APIRequestContext } from '@playwright/test'; 
  2  |  
  3  |  export async function loginAs( 
  4  |    request: APIRequestContext, 
  5  |    email: string, 
  6  |    password: string 
  7  |  ): Promise<string> { 
  8  |    const res = await request.post('/api/auth/login', { 
  9  |      data: { email, password }, 
  10 |    }); 
  11 |    const body = await res.json(); 
> 12 |    return body.data.accessToken; 
     |                     ^ TypeError: Cannot read properties of undefined (reading 'accessToken')
  13 |  } 
  14 |  
  15 |  export const ACCOUNTS = { 
  16 |    superAdmin: { email: 'superadmin@university.com', password: 'SuperAdmin123!' }, 
  17 |    doctor:     { email: 'doctor@university.com',     password: 'Password123!' }, 
  18 |    student:    { email: 'student@university.com',    password: 'Password123!' }, 
  19 |  }; 
  20 | 
```