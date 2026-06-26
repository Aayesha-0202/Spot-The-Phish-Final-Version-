import { api, unwrap, type Envelope } from './client';

export interface AuthUser {
  _id: string;
  email: string;
  username: string;
}

/**
 * All auth calls set/clear httpOnly cookies on the server; the returned user
 * object is just for client-side state (no tokens in JS memory/localStorage).
 */
export const authApi = {
  register: (username: string, email: string, password: string) =>
    unwrap<AuthUser>(api.post<Envelope<AuthUser>>('/auth/register', { username, email, password })),
  login: (email: string, password: string) =>
    unwrap<AuthUser>(api.post<Envelope<AuthUser>>('/auth/login', { email, password })),
  google: (credential: string) =>
    unwrap<AuthUser>(api.post<Envelope<AuthUser>>('/auth/google', { credential })),
  logout: () => api.post('/auth/logout'),
  me: () => unwrap<AuthUser>(api.get<Envelope<AuthUser>>('/auth/me')),
  forgotPassword: (email: string) =>
    unwrap<null>(api.post<Envelope<null>>('/auth/forgot-password', { email })),
  resetPassword: (token: string, password: string) =>
    unwrap<null>(api.post<Envelope<null>>('/auth/reset-password', { token, password })),
};
