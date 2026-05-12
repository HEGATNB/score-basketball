import { requestJson, type AuthUser } from '@/shared/api/client';

const TOKEN_KEY = 'token';

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export const authService = {
  async register(userData: { email: string; password: string; name?: string; username?: string }) {
    const result = await requestJson<AuthResult>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: userData.email,
        password: userData.password,
        name: userData.name || userData.username,
      }),
    });

    localStorage.setItem(TOKEN_KEY, result.token);
    return result;
  },

  async login(credentials: { identifier: string; password: string }) {
    const result = await requestJson<AuthResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    localStorage.setItem(TOKEN_KEY, result.token);
    return result;
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  isAuthenticated() {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  },
};