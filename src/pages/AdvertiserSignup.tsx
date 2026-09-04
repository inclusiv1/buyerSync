import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

const AdvertiserSignup = () => {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setError('');
      const { data } = await api.post('/auth/advertiser-signup', form);
      setToken(data.token);
      setUser(data.user);
      navigate('/advertiser');
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || 'Could not create advertiser account');
    }
  };

  return (
    <div className="editorial-shell flex min-h-screen items-center justify-center p-5">
      <Card className="w-full max-w-lg bg-background/90">
        <CardHeader><p className="eyebrow">Buyer Sync partners</p><CardTitle className="text-4xl">Create an advertiser account</CardTitle><p className="text-sm text-muted-foreground">Submit brand-safe campaigns for manual review and invoicing.</p></CardHeader>
        <CardContent><form className="space-y-4" onSubmit={submit}>
          <Input required minLength={2} placeholder="Business or contact name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
          <Input required type="email" placeholder="Email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
          <Input required type="password" minLength={8} placeholder="Password (8+ characters)" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full" type="submit">Create advertiser account</Button>
        </form><p className="mt-5 text-center text-sm text-muted-foreground">Already registered? <Link className="text-primary underline" to="/login">Sign in</Link></p></CardContent>
      </Card>
    </div>
  );
};

export default AdvertiserSignup;