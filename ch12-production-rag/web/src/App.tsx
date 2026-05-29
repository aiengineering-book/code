// #book-ref ch11-rag/web/src/App.tsx
import { RAGAnswer } from './components/RAGAnswer.js';

export default function App() {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1rem' }}>
    <h1>RAG Knowledge Base Q&A</h1>
      <RAGAnswer answer="" citations={[]} />
    </div>
  );
}
