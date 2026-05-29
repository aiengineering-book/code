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
          退出登录
        </button>
        <TodoList />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>{isRegister ? '注册' : '登录'}</h1>
      <form onSubmit={handleSubmit}>
        {isRegister && (
          <input
            type="text"
            placeholder="昵称"
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
          placeholder="邮箱"
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
          placeholder="密码"
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
          {loading ? '处理中...' : isRegister ? '注册' : '登录'}
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
          {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
        </button>
      </p>
    </div>
  );
}
