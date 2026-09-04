import { useEffect } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Invite from '@/pages/Invite';
import Dashboard from '@/pages/Dashboard';
import PropertyDetail from '@/pages/PropertyDetail';
import Checklist from '@/pages/Checklist';
import Comparison from '@/pages/Comparison';
import AdvertiserSignup from '@/pages/AdvertiserSignup';
import AdvertisingPortal from '@/pages/AdvertisingPortal';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';

const queryClient = new QueryClient();

const RoleLanding = () => {
  const { token, user } = useAuthStore();
  if (token && !user) return <div className="p-10 text-center">Loading account…</div>;
  if (user?.role === 'advertiser') return <Navigate to="/advertiser" replace />;
  if (user?.role === 'admin') return <Navigate to="/admin/ads" replace />;
  return <Dashboard />;
};

const App = () => {
  const { token, setUser } = useAuthStore();

  useEffect(() => {
    // Always fetch /me to get user info, even without token (backend will provide guest)
    api.get('/me')
      .then(res => setUser(res.data))
      .catch(() => {
        // If it fails, we don't necessarily clear everything if we want to stay in guest mode
        // but for now let's keep it simple
      });
  }, [token, setUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/advertise/signup" element={<AdvertiserSignup />} />
          <Route path="/advertise" element={<AdvertisingPortal />} />
          <Route path="/advertiser" element={<AdvertisingPortal />} />
          <Route path="/admin/ads" element={<AdvertisingPortal admin />} />
          <Route path="/invite/:token" element={<Invite />} />
          <Route path="/" element={<RoleLanding />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
          <Route path="/checklist" element={<Checklist />} />
          <Route path="/compare" element={<Comparison />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
