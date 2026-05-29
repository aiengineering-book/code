import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatInterface } from './components/ChatInterface.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChatInterface />
  </StrictMode>,
);
