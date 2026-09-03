import axios from 'axios';
import { authStorage } from '@/lib/authStorage';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
});

api.interceptors.request.use((config) => {
  const token = authStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
