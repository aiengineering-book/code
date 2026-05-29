// Stub: 完整实现见 ch04
export function getToken(): string {
  return localStorage.getItem('token') ?? '';
}
