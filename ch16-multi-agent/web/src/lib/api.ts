// Stub: see ch04 for full implementation
export function getToken(): string {
  return localStorage.getItem('token') ?? '';
}
