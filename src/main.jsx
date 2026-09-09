import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import App from './App.jsx';
import { RestaurantsProvider } from './context/RestaurantsContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { EASE } from './lib/motion.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* reducedMotion="user" → Framer Motion azzera translate/scale/opacity
          quando l'utente ha prefers-reduced-motion. Transizione di default
          coerente col motion language del prodotto. */}
      <MotionConfig reducedMotion="user" transition={{ ease: EASE.out }}>
        <ToastProvider>
          <RestaurantsProvider>
            <App />
          </RestaurantsProvider>
        </ToastProvider>
      </MotionConfig>
    </BrowserRouter>
  </React.StrictMode>,
);
