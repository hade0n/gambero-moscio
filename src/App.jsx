import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Backend from './pages/Backend.jsx';
import ToastContainer from './components/ToastContainer.jsx';

const GamePage = lazy(() => import('./pages/GamePage.jsx'));

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/backend" element={<Backend />} />
        <Route
          path="/game"
          element={
            <Suspense
              fallback={
                <div className="min-h-dvh flex items-center justify-center bg-cream text-brown font-display text-lg">
                  Apertura de Il Banco del Gambero…
                </div>
              }
            >
              <GamePage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </>
  );
}
