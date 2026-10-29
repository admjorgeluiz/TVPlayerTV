import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tizen-tv.css';

// Registrar Service Worker para permitir instalação como aplicativo Desktop PWA
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  const isTV = Boolean((window as any).tizen || (window as any).webOS || (window as any).PalmSystem);
  if (!isTV) {
    const registerSW = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => console.log('[PWA] Service Worker ativo:', reg.scope))
        .catch((err) => console.warn('[PWA] Falha no Service Worker:', err));
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
