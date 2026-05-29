// #book ch04-api-client
// ch04-fullstack-basics/web/src/lib/api.ts
import { hc } from 'hono/client';
import type { AppType } from '../../../server/src/index.js';

// hc<AppType> generates a type-safe client from the server's route definitions
export const api = hc<AppType>('http://localhost:3000');

// Token management (localStorage — use httpOnly cookies in production for better security)
const TOKEN_KEY = 'auth_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
// #endbook
