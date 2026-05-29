// #book ch04-todolist-component
import { useEffect, useState } from 'react';
// ch04-fullstack-basics/web/src/components/TodoList.tsx
import { api, getToken } from '../lib/api.js';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState(true);

  const headers = { Authorization: `Bearer ${getToken()}` };

  async function fetchTodos() {
    const res = await api.api.todos.$get({}, { headers });
    if (res.ok) {
      const data = await res.json();
      setTodos(data as Todo[]);
    }
    setLoading(false);
  }

  async function createTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const res = await api.api.todos.$post(
      { json: { title: newTitle } },
      { headers },
    );

    if (res.ok) {
      const todo = await res.json();
      setTodos((prev) => [todo as Todo, ...prev]);
      setNewTitle('');
    }
  }

  async function toggleTodo(id: string, completed: boolean) {
    const res = await api.api.todos[':id'].$patch(
      { param: { id }, json: { completed: !completed } },
      { headers },
    );

    if (res.ok) {
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t)),
      );
    }
  }

  async function deleteTodo(id: string) {
    await api.api.todos[':id'].$delete({ param: { id } }, { headers });
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  if (loading) return <div>加载中...</div>;

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>我的待办</h1>

      <form
        onSubmit={createTodo}
        style={{ display: 'flex', gap: 8, marginBottom: 24 }}
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="新建待办..."
          style={{ flex: 1, padding: '8px 12px', fontSize: 16 }}
        />
        <button type="submit" style={{ padding: '8px 16px' }}>
          添加
        </button>
      </form>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {todos.map((todo) => (
          <li
            key={todo.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 0',
              borderBottom: '1px solid #eee',
            }}
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id, todo.completed)}
            />
            <span
              style={{
                flex: 1,
                textDecoration: todo.completed ? 'line-through' : 'none',
                color: todo.completed ? '#999' : 'inherit',
              }}
            >
              {todo.title}
            </span>
            <button
              onClick={() => deleteTodo(todo.id)}
              style={{
                color: '#e53e3e',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              删除
            </button>
          </li>
        ))}
      </ul>

      {todos.length === 0 && (
        <p style={{ textAlign: 'center', color: '#999' }}>
          还没有待办，添加一个吧
        </p>
      )}
    </div>
  );
}
// #endbook
