import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone: z.string().trim().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const Signup = () => {
  const { setToken, setUser } = useAuthStore();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', phone: '', password: '' },
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
    <AuthLayout
      eyebrow="Your shared search starts here"
      title={<>Find home,<br /><span className="metallic-text">in sync.</span></>}
      description="Create one calm workspace where every decision, dollar, tour, and trusted advisor stays connected."
      image="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=88"
    >
          <p className="hearth-eyebrow text-champagne">Begin your shared space</p>
          <h2 className="mt-4 font-sans text-4xl font-semibold tracking-[-0.045em]">Create an account</h2>
          <p className="mt-3 text-sm leading-6 text-white/42">Bring every listing, note, and perspective together.</p>
          <div className="mt-5 flex gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.06] p-4 text-xs leading-5 text-white/55">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <p><span className="font-semibold text-white/80">Completely free.</span> No plans, credit card, or surprise charges.</p>
          </div>
          <div className="mt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm font-medium text-red-200" role="alert">
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
                      <Input autoComplete="name" placeholder="Your full name" {...field} />
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
                      <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }: any) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Mobile Phone</FormLabel>
                      <span className="text-[11px] text-champagne/80 font-medium">iMessage & SMS alerts</span>
                    </div>
                    <FormControl>
                      <Input type="tel" autoComplete="tel" placeholder="(555) 000-0000" {...field} />
                    </FormControl>
                    <p className="text-[11px] text-white/45">
                      Optional: Receive real-time property updates, listing cards, and query search status directly via text.
                    </p>
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
                      <Input type="password" autoComplete="new-password" placeholder="At least 8 characters" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="shimmer-button mt-2 w-full gap-2 rounded-xl bg-champagne text-[#11100d] hover:bg-white hover:text-[#11100d]" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Creating your account…' : <>Create my free account <ArrowRight className="h-4 w-4" /></>}</Button>
            </form>
          </Form>
          <div className="mt-5 text-center text-xs text-white/38">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-champagne hover:text-white">
              Sign in
            </Link>
          </div>
          </div>
    </AuthLayout>
  );
};

export default Signup;
