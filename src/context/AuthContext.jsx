import { createContext, useContext, useState, useCallback } from 'react';

/**
 * Simple auth context for the LollyD dashboard.
 * Credentials are checked client-side with SHA-256 hashing.
 * 
 * Default credentials: admin / admin123
 * To change, update the USERS array below.
 */

// ─── USERS ─────────────────────────────────
// SHA-256 hashes of passwords. To add users or change passwords:
//   1. Open browser console
//   2. Run: crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword')).then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('')))
//   3. Replace the hash below
const USERS = [
  {
    username: 'admin',
    // SHA-256 of 'admin123'
    passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    displayName: 'Administrator',
    role: 'admin',
  },
];

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('lollyd_auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if session is still valid (24 hours)
        if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
          return parsed;
        }
        localStorage.removeItem('lollyd_auth');
      }
    } catch {}
    return null;
  });

  const login = useCallback(async (username, password) => {
    const hash = await sha256(password);
    const found = USERS.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === hash
    );

    if (!found) {
      throw new Error('Invalid username or password');
    }

    const session = {
      username: found.username,
      displayName: found.displayName,
      role: found.role,
      loginTime: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    localStorage.setItem('lollyd_auth', JSON.stringify(session));
    setUser(session);
    return session;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('lollyd_auth');
    localStorage.removeItem('lollyd_ws_url');
    setUser(null);
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
