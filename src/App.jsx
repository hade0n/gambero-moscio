import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Backend from './pages/Backend.jsx';
import ToastContainer from './components/ToastContainer.jsx';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/backend" element={<Backend />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </>
  );
}
