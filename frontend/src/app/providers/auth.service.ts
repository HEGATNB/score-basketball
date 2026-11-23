import { clearSession, requestJson, type AuthUser } from '@/shared/api/client';

const TOKEN_KEY = 'token';

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export const authService = {
  async register(userData: { email: string; password: string; name?: string; username?: string }) {
    await requestJson<AuthUser>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    return this.login({ identifier: userData.email, password: userData.password });
  },

  async login(credentials: { identifier: string; password: string }) {
    const result = await requestJson<AuthResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    localStorage.setItem(TOKEN_KEY, result.token);
    return result;
  },

  async logout() {
    const token = this.getToken();
    try {
      if (token) await requestJson('/auth/logout', { method: 'POST' });
    } finally {
      if (token === this.getToken()) clearSession();
    }
  },

  async logoutAll() {
    await requestJson('/auth/logout-all', { method: 'POST' });
    clearSession();
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  isAuthenticated() {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  },

  async updateProfile(patch: { name?: string; username?: string; email?: string }) {
    return requestJson<AuthUser>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    return requestJson<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};