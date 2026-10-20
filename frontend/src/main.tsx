import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { useStudioStore } from './store/useStudioStore';

if (typeof window !== 'undefined') {
  (window as any).useStudioStore = useStudioStore;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
