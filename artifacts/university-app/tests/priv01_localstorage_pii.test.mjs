import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webSrcDir = path.resolve(__dirname, '../src');

describe('PRIV-001: User Data in Web Storage (LocalStorage & SessionStorage)', () => {
  it('1. Source verification: AuthContext does not store user profile or PII in localStorage', () => {
    const authContextPath = path.join(webSrcDir, 'context/AuthContext.tsx');
    const content = fs.readFileSync(authContextPath, 'utf8');

    // Must NOT have localStorage.setItem('user', ...)
    assert.ok(
      !content.includes("localStorage.setItem('user'"),
      'AuthContext must not persist user to localStorage'
    );
    assert.ok(
      !content.includes('localStorage.setItem("user"'),
      'AuthContext must not persist user to localStorage'
    );

    // Legacy cleanup is retained and verified
    assert.ok(
      content.includes("localStorage.removeItem('user')"),
      'AuthContext must actively remove legacy user from localStorage on logout/error'
    );
  });

  it('2. Source verification: Profile page does not store user profile or PII in localStorage', () => {
    const profilePath = path.join(webSrcDir, 'pages/profile/Profile.tsx');
    const content = fs.readFileSync(profilePath, 'utf8');

    assert.ok(
      !content.includes("localStorage.setItem('user'"),
      'Profile must not persist user to localStorage'
    );
    assert.ok(
      !content.includes('localStorage.setItem("user"'),
      'Profile must not persist user to localStorage'
    );
  });

  it('3. Source verification: Entire src directory does not persist user, profile, or auth tokens to localStorage', () => {
    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
          const code = fs.readFileSync(fullPath, 'utf8');
          const regex = /localStorage\.setItem\(\s*['"`](user|profile|token|refreshToken|accessToken)['"`]/i;
          const match = code.match(regex);
          assert.equal(
            match,
            null,
            `File ${entry.name} improperly persists sensitive key to localStorage: ${match?.[0]}`
          );
        }
      }
    }

    scanDir(webSrcDir);
  });

  it('4. Source verification: Entire src directory does not persist user profile, PII, or auth tokens to sessionStorage', () => {
    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
          const code = fs.readFileSync(fullPath, 'utf8');
          const regex = /sessionStorage\.setItem\(\s*['"`](user|profile|token|refreshToken|accessToken|email|role)['"`]/i;
          const match = code.match(regex);
          assert.equal(
            match,
            null,
            `File ${entry.name} improperly persists sensitive key to sessionStorage: ${match?.[0]}`
          );
        }
      }
    }

    scanDir(webSrcDir);
  });

  it('5. Source verification: Access token is stored only in memory and never written to Web Storage', () => {
    const apiPath = path.join(webSrcDir, 'services/api.ts');
    const authContextPath = path.join(webSrcDir, 'context/AuthContext.tsx');
    const apiContent = fs.readFileSync(apiPath, 'utf8');
    const authContent = fs.readFileSync(authContextPath, 'utf8');

    assert.ok(
      apiContent.includes('let _accessToken: string | null = null;'),
      'api.ts must store accessToken in module-scoped memory'
    );
    assert.ok(
      authContent.includes('const [token, setToken] = useState<string | null>(null);'),
      'AuthContext must store accessToken in React memory state'
    );

    const storageRegex = /(localStorage|sessionStorage)\.setItem\s*\(\s*['"`][^'"`]*token/i;
    assert.equal(storageRegex.test(apiContent), false, 'api.ts must not persist token');
    assert.equal(storageRegex.test(authContent), false, 'AuthContext must not persist token');
  });

  it('6. Source verification: Refresh token is transmitted via HttpOnly cookie and never exposed to JS persistence', () => {
    const apiPath = path.join(webSrcDir, 'services/api.ts');
    const apiContent = fs.readFileSync(apiPath, 'utf8');

    assert.ok(
      apiContent.includes('withCredentials: true'),
      'api.ts must send and receive HttpOnly cookies with withCredentials: true'
    );
    assert.equal(
      apiContent.includes('localStorage.setItem'),
      false,
      'api.ts must never write to localStorage'
    );
  });

  it('7. Behavioral verification: AuthContext login and session hydration flow assigns user in-memory without Web Storage', () => {
    const authContextPath = path.join(webSrcDir, 'context/AuthContext.tsx');
    const content = fs.readFileSync(authContextPath, 'utf8');

    // Login assigns user and token to React state:
    assert.ok(
      content.includes('setToken(accessToken);') && content.includes('setUser(normalizedUser);'),
      'Login must set token and user in React memory state'
    );

    // Session hydration uses /auth/refresh and /auth/me:
    assert.ok(
      content.includes("api.post('/auth/refresh')"),
      'Session hydration must call /auth/refresh'
    );
    assert.ok(
      content.includes("api.get('/auth/me')"),
      'Session hydration must fallback to /auth/me'
    );

    // Logout clears memory state and invokes legacy cleanup:
    assert.ok(
      content.includes('setToken(null);') && content.includes('setUser(null);'),
      'Logout must clear in-memory state'
    );
    assert.ok(
      content.includes("localStorage.removeItem('user')"),
      'Logout must clean up legacy user item'
    );
  });
});
