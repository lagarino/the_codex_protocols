import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Builder from './screens/Builder.jsx';
import Filter  from './screens/Filter.jsx';
import Print   from './screens/Print.jsx';
import Header  from './components/Header.jsx';
import Toast   from './components/Toast.jsx';
import ProfileBanner from './components/ProfileBanner.jsx';
import './styles/global.css';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header />
        <ProfileBanner />
        <Routes>
          <Route path="/"       element={<Builder />} />
          <Route path="/filter" element={<Filter />} />
          <Route path="/print"  element={<Print />} />
          <Route path="*"       element={<Navigate to="/" replace />} />
        </Routes>
        <Toast />
      </div>
    </BrowserRouter>
  );
}
