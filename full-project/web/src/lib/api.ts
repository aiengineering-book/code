export function getToken(): string {
  return localStorage.getItem('token') ?? '';
}

export function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}
