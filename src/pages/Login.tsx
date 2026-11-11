import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { isTestMode } from '@/lib/authStorage';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Users } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';

interface TestUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const Login = () => {
  const { setToken, setUser } = useAuthStore();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const [error, setError] = useState<string | null>(null);
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [testUsersLoading, setTestUsersLoading] = useState(isTestMode);
  const [testUsersError, setTestUsersError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTestMode) return;

    api.get('/auth/test-users')
      .then(({ data }) => {
        setTestUsers(data);
        if (data.length !== 3) setTestUsersError('The three test accounts are not ready. Restart with npm run dev:test.');
      })
      .catch(() => setTestUsersError('Test accounts could not be loaded. Stop the current servers and restart with npm run dev:test.'))
      .finally(() => setTestUsersLoading(false));
  }, []);

  const completeLogin = (data: { token: string; user: TestUser }) => {
    setToken(data.token);
    setUser(data.user);
    navigate(data.user.role === 'admin' ? '/admin/ads' : '/');
  };

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    try {
      setError(null);
      const { data } = await api.post('/auth/login', values);
      completeLogin(data);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Login failed. Please check your credentials.');
      console.error(error);
    }
  };

  const loginAsTestUser = async (email: string) => {
    try {
      setError(null);
      const { data } = await api.post('/auth/test-login', { email });
      completeLogin(data);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Could not start the test session.');
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title={<>Everything closer.<br /><span className="metallic-text">Everyone aligned.</span></>}
      description="Return to the shared operating system for your shortlist, finances, tours, and buying team."
      image="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1800&q=88"
    >
          <p className="hearth-eyebrow text-champagne">Your shared workspace</p>
          <h2 className="mt-4 font-sans text-4xl font-semibold tracking-[-0.045em]">Sign in</h2>
          <p className="mt-3 text-sm text-white/42">Pick up exactly where your team left off.</p>
          {isTestMode && (
            <div className="mb-6 mt-5 space-y-3 rounded-2xl border border-violet-300/15 bg-violet-400/[0.06] p-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" /> Three-user test workspace</p>
                <p className="mt-1 text-xs leading-5 text-white/40">Choose a buyer for this tab. Use <span className="font-medium text-white/70">Another user</span> in the workspace to open other perspectives.</p>
              </div>
              {testUsersLoading && <p className="text-sm text-muted-foreground" role="status">Preparing Alex, Blair, and Cameron…</p>}
              {testUsersError && <p className="text-sm text-red-600" role="alert">{testUsersError}</p>}
              {!testUsersLoading && !testUsersError && (
                <div className="grid gap-2">
                  {testUsers.map(testUser => (
                    <Button key={testUser.id} type="button" variant="outline" className="h-auto justify-between px-3 py-2 text-left" onClick={() => loginAsTestUser(testUser.email)}>
                      <span>
                        <span className="block text-sm">{testUser.name}</span>
                        <span className="block text-xs font-normal text-muted-foreground">{testUser.role === 'primary_buyer' ? 'Primary buyer' : 'Co-buyer'}</span>
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm font-medium text-red-200" role="alert">
                  {error}
                </div>
              )}
              <FormField
                control={form.control}
                name="email"
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" placeholder="Your password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="shimmer-button mt-2 w-full gap-2 rounded-xl bg-champagne text-[#11100d] hover:bg-white hover:text-[#11100d]" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Signing in…' : <>Sign in <ArrowRight className="h-4 w-4" /></>}</Button>
            </form>
          </Form>
          <div className="mt-5 text-center text-xs text-white/38">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-champagne hover:text-white">
              Create an account
            </Link>
          </div>
          <p className="mt-3 text-center text-xs text-white/30">Want to advertise? <Link to="/advertise/signup" className="font-medium text-white/55 hover:text-white">Create a partner account</Link></p>
    </AuthLayout>
  );
};

export default Login;
