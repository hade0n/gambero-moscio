import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { RestaurantsProvider } from './context/RestaurantsContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <RestaurantsProvider>
          <App />
        </RestaurantsProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
