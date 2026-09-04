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
import Landing from '@/pages/Landing';
import Disclaimer from '@/pages/Disclaimer';
import SiteFooter from '@/components/SiteFooter';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';

const queryClient = new QueryClient();

const RoleLanding = () => {
  const { token, user } = useAuthStore();
  if (!token) return <Landing />;
  if (token && !user) return <div className="p-10 text-center">Loading account…</div>;
  if (user?.role === 'advertiser') return <Navigate to="/advertiser" replace />;
  if (user?.role === 'admin') return <Navigate to="/admin/ads" replace />;
  return <Dashboard />;
};

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (!user) return <div className="p-10 text-center">Loading account…</div>;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const App = () => {
  const { token, setUser, logout } = useAuthStore();

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    api.get('/me')
      .then(res => setUser(res.data))
      .catch(() => logout());
  }, [token, setUser, logout]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/advertise/signup" element={<AdvertiserSignup />} />
          <Route path="/advertise" element={<ProtectedRoute roles={['advertiser']}><AdvertisingPortal /></ProtectedRoute>} />
          <Route path="/advertiser" element={<ProtectedRoute roles={['advertiser']}><AdvertisingPortal /></ProtectedRoute>} />
          <Route path="/admin/ads" element={<ProtectedRoute roles={['admin']}><AdvertisingPortal admin /></ProtectedRoute>} />
          <Route path="/invite/:token" element={<Invite />} />
          <Route path="/" element={<RoleLanding />} />
          <Route path="/property/:id" element={<ProtectedRoute><PropertyDetail /></ProtectedRoute>} />
          <Route path="/checklist" element={<ProtectedRoute><Checklist /></ProtectedRoute>} />
          <Route path="/compare" element={<ProtectedRoute><Comparison /></ProtectedRoute>} />
        </Routes>
        <SiteFooter />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
