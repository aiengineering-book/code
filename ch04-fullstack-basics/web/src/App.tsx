import { useState } from 'react';
import { TodoList } from './components/TodoList.js';
import { useAuth } from './hooks/useAuth.js';

export default function App() {
  const { login, register, logout, loading, error } = useAuth();
  const [isLoggedIn, setIsLoggedIn] = useState(
    !!localStorage.getItem('auth_token'),
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const success = isRegister
      ? await register(name, email, password)
      : await login(email, password);
    if (success) setIsLoggedIn(true);
  }

  if (isLoggedIn) {
    return (
      <div>
        <button
          onClick={() => {
            logout();
            setIsLoggedIn(false);
          }}
          style={{ float: 'right', margin: '1rem' }}
        >
          Sign out
        </button>
        <TodoList />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>{isRegister ? 'Register' : 'Sign in'}</h1>
      <form onSubmit={handleSubmit}>
        {isRegister && (
          <input
            type="text"
            placeholder="Nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{
              display: 'block',
              width: '100%',
              marginBottom: '0.5rem',
              padding: '0.5rem',
            }}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            display: 'block',
            width: '100%',
            marginBottom: '0.5rem',
            padding: '0.5rem',
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            display: 'block',
            width: '100%',
            marginBottom: '0.5rem',
            padding: '0.5rem',
          }}
        />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '0.5rem' }}
        >
          {loading ? 'Loading...' : isRegister ? 'Register' : 'Sign in'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button
          onClick={() => setIsRegister(!isRegister)}
          style={{
            background: 'none',
            border: 'none',
            color: 'blue',
            cursor: 'pointer',
          }}
        >
          {isRegister
            ? 'Already have an account? Sign in'
            : 'No account? Register'}
        </button>
      </p>
    </div>
  );
}
