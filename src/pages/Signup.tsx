import { useState } from 'react';
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
import { ArrowRight, Home, Users } from 'lucide-react';

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const Signup = () => {
  const { setToken, setUser } = useAuthStore();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const [error, setError] = useState<string | null>(null);
  const onSubmit = async (values: z.infer<typeof signupSchema>) => {
    try {
      setError(null);
      const { data } = await api.post('/auth/signup', values);
      setToken(data.token);
      setUser(data.user);
      navigate('/');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Signup failed. Please try again.');
      console.error(error);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.15fr_0.85fr]">
      <section
        className="auth-visual hidden min-h-screen lg:flex lg:flex-col lg:justify-between lg:p-12"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=88')" }}
      >
        <div className="flex items-center justify-between text-white">
          <div className="font-serif text-3xl">BuyerSync</div>
          <span className="glass-label"><Users className="h-3.5 w-3.5" /> Built for two</span>
        </div>
        <div className="max-w-xl text-white">
          <p className="mb-5 flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.3em] text-white/75"><Home className="h-3.5 w-3.5" /> A shared point of view</p>
          <h1 className="font-serif text-7xl font-medium leading-[0.9]">The next chapter<br /><em>starts at home.</em></h1>
          <p className="mt-7 max-w-md border-l border-white/45 pl-4 text-sm leading-6 text-white/80">Turn a crowded search into a calm, shared path from first save to front-door keys.</p>
        </div>
      </section>
      <section className="relative flex items-center justify-center px-5 pb-12 pt-44 md:px-12 lg:py-12">
      <div className="absolute inset-x-5 top-5 h-28 bg-cover bg-center lg:hidden" style={{ backgroundImage: "linear-gradient(90deg, rgba(28,31,26,.2), rgba(28,31,26,.65)), url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80')" }}><span className="absolute bottom-4 left-4 font-serif text-2xl text-white">BuyerSync</span></div>
      <Card className="w-full max-w-md border-0 bg-transparent shadow-none">
        <CardHeader className="px-0">
          <p className="eyebrow mb-3">Begin your collection</p>
          <CardTitle className="text-5xl">Create an account</CardTitle>
          <p className="pt-2 text-sm text-muted-foreground">Bring every listing, note, and perspective together.</p>
          <div className="mt-4 flex gap-3 border border-primary/20 bg-primary/5 p-4 text-sm leading-6">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">✓</span>
            <p><span className="font-semibold text-foreground">BuyerSync is completely free.</span> There are no paid plans, subscriptions, credit card requirements, or charges after signup.</p>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded text-sm font-medium">
                  {error}
                </div>
              )}
              <FormField
                control={form.control}
                name="name"
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              <Button type="submit" className="mt-2 w-full gap-2">Create my free account <ArrowRight className="h-4 w-4" /></Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
      </section>
    </div>
  );
};

export default Signup;
