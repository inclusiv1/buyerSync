import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Heart, KeyRound, Users } from 'lucide-react';

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

  useEffect(() => {
    api.get('/auth/test-users')
      .then(({ data }) => setTestUsers(data))
      .catch(() => setTestUsers([]));
  }, []);

  const completeLogin = (data: { token: string; user: TestUser }) => {
    setToken(data.token);
    setUser(data.user);
    navigate('/');
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
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.15fr_0.85fr]">
      <section
        className="auth-visual hidden min-h-screen lg:flex lg:flex-col lg:justify-between lg:p-12"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1800&q=88')" }}
      >
        <div className="flex items-center justify-between text-white">
          <div className="font-serif text-3xl">BuyerSync</div>
          <span className="glass-label"><KeyRound className="h-3.5 w-3.5" /> Decisions, together</span>
        </div>
        <div className="max-w-xl text-white">
          <p className="mb-5 flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.3em] text-white/75"><Heart className="h-3.5 w-3.5" /> Curated for considered decisions</p>
          <h1 className="font-serif text-7xl font-medium leading-[0.9]">Find the home<br /><em>your future fits.</em></h1>
          <p className="mt-7 max-w-md border-l border-white/45 pl-4 text-sm leading-6 text-white/80">One beautiful place for listings, impressions, trade-offs, and the decision you make together.</p>
        </div>
      </section>
      <section className="relative flex items-center justify-center px-5 pb-12 pt-44 md:px-12 lg:py-12">
      <div className="absolute inset-x-5 top-5 h-28 bg-cover bg-center lg:hidden" style={{ backgroundImage: "linear-gradient(90deg, rgba(28,31,26,.2), rgba(28,31,26,.65)), url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=900&q=80')" }}><span className="absolute bottom-4 left-4 font-serif text-2xl text-white">BuyerSync</span></div>
      <Card className="w-full max-w-md border-0 bg-transparent shadow-none">
        <CardHeader className="px-0">
          <p className="eyebrow mb-3">Welcome back</p>
          <CardTitle className="text-5xl">Sign in</CardTitle>
          <p className="pt-2 text-sm text-muted-foreground">Continue your thoughtful home search.</p>
        </CardHeader>
        <CardContent>
          {testUsers.length > 0 && (
            <div className="mb-6 space-y-3 border border-primary/20 bg-primary/5 p-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" /> Test mode</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose one user for this page. Open <span className="font-medium text-foreground">/login</span> in another page to score as someone else at the same time.</p>
              </div>
              <div className="grid gap-2">
                {testUsers.map(testUser => (
                  <Button key={testUser.id} type="button" variant="outline" className="h-auto justify-between px-3 py-2 text-left" onClick={() => loginAsTestUser(testUser.email)}>
                    <span><span className="block text-sm">{testUser.name}</span><span className="block text-xs font-normal text-muted-foreground">{testUser.email}</span></span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded text-sm font-medium">
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
                      <Input type="email" placeholder="john@example.com" {...field} />
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
                      <Input type="password" placeholder="******" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="mt-2 w-full gap-2">Sign in <ArrowRight className="h-4 w-4" /></Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </div>
        </CardContent>
      </Card>
      </section>
    </div>
  );
};

export default Login;
