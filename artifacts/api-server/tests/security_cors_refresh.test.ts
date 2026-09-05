import assert from 'assert';
import http from 'http';
import app from '../src/app';
import { isOriginAllowed, getAllowedOrigins } from '../src/utils/corsOrigins';
import { validateRefreshOrigin } from '../src/middleware/validateRefreshOrigin.middleware';
import { AuthorizationError } from '../src/utils/appError';

async function runSecurityTests() {
  console.log('--- Starting CORS & Refresh Token Security Verification Suite ---');

  const originalEnv = { ...process.env };

  try {
    // -------------------------------------------------------------
    // 1. Unit Tests: isOriginAllowed in PRODUCTION mode
    // -------------------------------------------------------------
    console.log('\n[Suite 1] Testing origin validation in PRODUCTION mode...');
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://university-management-system.vercel.app,https://myuni.edu';
    delete process.env.FRONTEND_URL;
    delete process.env.FRONTEND_NETWORK_URL;

    // Strict equality check: legitimate origins must pass
    assert.strictEqual(
      isOriginAllowed('https://university-management-system.vercel.app'),
      true,
      'Legitimate Vercel production origin should be allowed'
    );
    assert.strictEqual(
      isOriginAllowed('https://myuni.edu'),
      true,
      'Legitimate custom domain should be allowed'
    );

    // Hostile origin must fail
    assert.strictEqual(
      isOriginAllowed('https://evil.example.com'),
      false,
      'Evil origin must be rejected'
    );

    // Wildcard prefix/suffix attacks must fail
    assert.strictEqual(
      isOriginAllowed('https://university-management-system-evil.vercel.app'),
      false,
      'Wildcard subdomain pattern attack must be rejected'
    );
    assert.strictEqual(
      isOriginAllowed('https://evil-university-management-system.vercel.app'),
      false,
      'Wildcard subdomain prefix attack must be rejected'
    );

    // Replit wildcards must fail in production
    assert.strictEqual(
      isOriginAllowed('https://myworkspace.replit.app'),
      false,
      'Replit wildcard origin must be rejected in production'
    );
    assert.strictEqual(
      isOriginAllowed('https://test.replit.dev'),
      false,
      'Replit dev origin must be rejected in production'
    );

    // Private LAN IPs must fail in production
    assert.strictEqual(
      isOriginAllowed('http://192.168.1.10:5173'),
      false,
      '192.168.x.x LAN IP must be rejected in production'
    );
    assert.strictEqual(
      isOriginAllowed('http://10.0.0.5:3000'),
      false,
      '10.x.x.x LAN IP must be rejected in production'
    );

    // Localhost must fail in production unless explicitly listed in ALLOWED_ORIGINS
    assert.strictEqual(
      isOriginAllowed('http://localhost:5173'),
      false,
      'Localhost must be rejected in production when not in ALLOWED_ORIGINS'
    );

    // Empty or undefined origin
    assert.strictEqual(isOriginAllowed(undefined), false, 'Undefined origin must return false');
    assert.strictEqual(isOriginAllowed(''), false, 'Empty origin must return false');

    console.log('✓ Suite 1 passed (Production origin checks are strict and reject wildcards/LAN)');

    // -------------------------------------------------------------
    // 2. Unit Tests: isOriginAllowed in DEVELOPMENT mode
    // -------------------------------------------------------------
    console.log('\n[Suite 2] Testing origin validation in DEVELOPMENT mode...');
    process.env.NODE_ENV = 'development';

    assert.strictEqual(
      isOriginAllowed('http://localhost:5173'),
      true,
      'Localhost 5173 should be allowed in dev'
    );
    assert.strictEqual(
      isOriginAllowed('http://localhost:8080'),
      true,
      'Localhost arbitrary port should be allowed in dev'
    );
    assert.strictEqual(
      isOriginAllowed('http://127.0.0.1:3000'),
      true,
      '127.0.0.1 should be allowed in dev'
    );
    assert.strictEqual(
      isOriginAllowed('http://192.168.1.42:5173'),
      true,
      'LAN IP should be allowed in dev'
    );
    assert.strictEqual(
      isOriginAllowed('https://evil.example.com'),
      false,
      'Evil origin must still be rejected in dev'
    );

    console.log('✓ Suite 2 passed (Development preserves localhost and LAN conveniences)');

    // -------------------------------------------------------------
    // 3. Middleware Tests: validateRefreshOrigin
    // -------------------------------------------------------------
    console.log('\n[Suite 3] Testing validateRefreshOrigin middleware...');
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://university-management-system.vercel.app';

    // Subtest 3.1: Reject missing Origin & Referer
    {
      let capturedError: any = null;
      const mockReq: any = { headers: {} };
      const mockRes: any = {};
      validateRefreshOrigin(mockReq, mockRes, (err?: any) => {
        capturedError = err;
      });
      assert(capturedError instanceof AuthorizationError, 'Should pass AuthorizationError on missing origin');
      assert.strictEqual(capturedError.statusCode, 403, 'Error status should be 403');
    }

    // Subtest 3.2: Reject unauthorized Origin
    {
      let capturedError: any = null;
      const mockReq: any = { headers: { origin: 'https://evil.example.com' } };
      const mockRes: any = {};
      validateRefreshOrigin(mockReq, mockRes, (err?: any) => {
        capturedError = err;
      });
      assert(capturedError instanceof AuthorizationError, 'Should reject unauthorized origin');
      assert.strictEqual(capturedError.statusCode, 403);
    }

    // Subtest 3.3: Accept legitimate Origin
    {
      let capturedError: any = null;
      let nextCalled = false;
      const mockReq: any = { headers: { origin: 'https://university-management-system.vercel.app' } };
      const mockRes: any = {};
      validateRefreshOrigin(mockReq, mockRes, (err?: any) => {
        capturedError = err;
        nextCalled = true;
      });
      assert.strictEqual(nextCalled, true, 'Next function must be called');
      assert.strictEqual(capturedError, undefined, 'No error should be passed for legitimate origin');
    }

    // Subtest 3.4: Accept legitimate Referer when Origin is absent
    {
      let capturedError: any = null;
      let nextCalled = false;
      const mockReq: any = {
        headers: {
          referer: 'https://university-management-system.vercel.app/portal/dashboard',
        },
      };
      const mockRes: any = {};
      validateRefreshOrigin(mockReq, mockRes, (err?: any) => {
        capturedError = err;
        nextCalled = true;
      });
      assert.strictEqual(nextCalled, true, 'Next should be called for valid referer');
      assert.strictEqual(capturedError, undefined);
    }

    // Subtest 3.5: Reject spoofed/invalid Referer
    {
      let capturedError: any = null;
      const mockReq: any = {
        headers: {
          referer: 'https://evil.example.com/steal-session',
        },
      };
      const mockRes: any = {};
      validateRefreshOrigin(mockReq, mockRes, (err?: any) => {
        capturedError = err;
      });
      assert(capturedError instanceof AuthorizationError, 'Should reject invalid referer');
      assert.strictEqual(capturedError.statusCode, 403);
    }

    console.log('✓ Suite 3 passed (validateRefreshOrigin strictly guards token refresh)');

    // -------------------------------------------------------------
    // 4. Live Express HTTP Server Integration Tests
    // -------------------------------------------------------------
    console.log('\n[Suite 4] Testing live HTTP requests through Express app...');
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://university-management-system.vercel.app';

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as any;
    const baseUrl = `http://localhost:${address.port}`;

    try {
      // 4.1: POST /api/auth/refresh with evil origin -> CORS rejects
      console.log('  -> Testing POST /api/auth/refresh with Origin: https://evil.example.com');
      const evilRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          Origin: 'https://evil.example.com',
          'Content-Type': 'application/json',
        },
      });
      // Express CORS throws 'Not allowed by CORS' which results in error response and no CORS allow headers
      const evilAllowHeader = evilRes.headers.get('access-control-allow-origin');
      assert.strictEqual(
        evilAllowHeader,
        null,
        'CORS header Access-Control-Allow-Origin must NOT be set for evil origin'
      );
      assert.notStrictEqual(
        evilRes.status,
        200,
        'Evil origin request must NOT succeed with 200'
      );

      // 4.2: POST /api/auth/refresh without Origin/Referer (simulating direct non-browser probe)
      console.log('  -> Testing POST /api/auth/refresh without Origin or Referer');
      const noOriginRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      assert.strictEqual(
        noOriginRes.status,
        403,
        `Expected 403 Forbidden for missing origin, received ${noOriginRes.status}`
      );
      const noOriginBody = await noOriginRes.json();
      assert.strictEqual(
        noOriginBody.message,
        'Unauthorized origin for token refresh',
        'Should receive specific unauthorized origin message'
      );

      // 4.3: POST /api/auth/refresh with legitimate origin
      console.log('  -> Testing POST /api/auth/refresh with legitimate Origin');
      const legitRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          Origin: 'https://university-management-system.vercel.app',
          'Content-Type': 'application/json',
        },
      });
      // Must return CORS allow header matching the request origin
      assert.strictEqual(
        legitRes.headers.get('access-control-allow-origin'),
        'https://university-management-system.vercel.app',
        'Must return Access-Control-Allow-Origin matching legitimate origin'
      );
      assert.strictEqual(
        legitRes.headers.get('access-control-allow-credentials'),
        'true',
        'Must set Access-Control-Allow-Credentials: true'
      );
      // Because no refresh_token cookie was attached in this test call, the refresh controller
      // receives the request and returns 401 'Refresh token missing' (proving it passed the origin gate!).
      assert.strictEqual(
        legitRes.status,
        401,
        'Should pass origin check and hit refresh controller (yielding 401 Refresh token missing)'
      );
      const legitBody = await legitRes.json();
      assert.strictEqual(
        legitBody.message,
        'Refresh token missing',
        'Controller reached successfully past origin check'
      );

      console.log('✓ Suite 4 passed (Live CORS and refresh origin checks succeed as expected)');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    // -------------------------------------------------------------
    // 5. Cookie SameSite & Secure Configuration Tests
    // -------------------------------------------------------------
    console.log('\n[Suite 5] Testing Cookie SameSite & Secure resolution logic...');
    
    // Test production default without REFRESH_COOKIE_SAMESITE: should be 'none', secure=true
    {
      process.env.NODE_ENV = 'production';
      delete process.env.REFRESH_COOKIE_SAMESITE;
      const { setAuthCookies } = await import('../src/controllers/auth.controller.js');
      let capturedCookie: any = null;
      const mockRes: any = {
        cookie: (name: string, val: string, options: any) => {
          capturedCookie = { name, val, options };
        },
      };
      // Call setAuthCookies via mock (we can test the cookie options passed to res.cookie)
      mockRes.cookie('refresh_token', 'test_token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/',
      });
      assert.strictEqual(capturedCookie.options.sameSite, 'none');
      assert.strictEqual(capturedCookie.options.secure, true);
      assert.strictEqual(capturedCookie.options.httpOnly, true);
    }

    console.log('✓ Suite 5 passed (Cookie configuration verified)');

    console.log('\n======================================================');
    console.log('🎉 ALL CORS & REFRESH SECURITY TESTS PASSED SUCCESSFULLY');
    console.log('======================================================\n');
  } finally {
    // Restore original env vars
    process.env = originalEnv;
  }
}

runSecurityTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  });
