// #book ch04-api-client
import { hc } from 'hono/client';
// ch04-fullstack-basics/web/src/lib/api.ts
import type { AppType } from '../../../server/src/index.js';

// hc<AppType> 基于服务端路由生成类型安全的客户端
export const api = hc<AppType>('http://localhost:3000');

// Token 管理（简单版，生产环境可以用 httpOnly Cookie 更安全）
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
