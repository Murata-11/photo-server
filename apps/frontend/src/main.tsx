import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
async function start() {
  const { setupWorker } = await import('msw/browser');
  const { handlers } = await import('./mocks/handlers');
  await setupWorker(...handlers).start({ onUnhandledRequest: 'bypass' });
  const root = document.getElementById('root');
  if (!root) throw new Error('アプリのマウント先が見つかりません');
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
start();
