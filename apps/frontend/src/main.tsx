import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
async function start() {
  const root = document.getElementById('root');
  if (!root) throw new Error('アプリのマウント先が見つかりません');
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
start();
