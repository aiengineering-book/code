// #book ch04-useauth-hook
// ch04-fullstack-basics/web/src/hooks/useAuth.ts
import { useCallback, useState } from 'react';
import { api, clearToken, setToken } from '../lib/api.js';

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.api.auth.login.$post({
        json: { email, password },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error((data as any).error?.message ?? 'Login failed');
      }

      const { token } = await res.json();
      setToken(token);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.api.auth.register.$post({
          json: { name, email, password },
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error((data as any).error?.message ?? 'Registration failed');
        }

        const { token } = await res.json();
        setToken(token);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Registration failed');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(() => {
    clearToken();
    window.location.href = '/login';
  }, []);

  return { login, register, logout, loading, error };
}
// #endbook
