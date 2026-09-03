import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Invite from '@/pages/Invite';
import Dashboard from '@/pages/Dashboard';
import PropertyDetail from '@/pages/PropertyDetail';
import Checklist from '@/pages/Checklist';
import Comparison from '@/pages/Comparison';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';

const queryClient = new QueryClient();

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
          <Route path="/invite/:token" element={<Invite />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
          <Route path="/checklist" element={<Checklist />} />
          <Route path="/compare" element={<Comparison />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
