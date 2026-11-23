import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './shared/ui/scoreboard.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
const splash = document.getElementById('app-splash');
if (splash) {
  const dismiss = () => {
    splash.classList.add('hidden');
    window.setTimeout(() => splash.remove(), 700);
  };
  if (document.readyState === 'complete') requestAnimationFrame(dismiss);
  else window.addEventListener('load', () => requestAnimationFrame(dismiss), { once: true });
}
