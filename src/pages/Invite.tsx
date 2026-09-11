import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import AuthLayout from '@/components/auth/AuthLayout';

const inviteSchema = z.object({
  name: z.string().min(2),
  password: z.string().min(6),
});

const Invite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();
  const [inviteInfo, setInviteInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/invites/${token}`)
      .then(res => setInviteInfo(res.data))
      .catch(() => setError('Invalid or expired invitation link.'));
  }, [token]);

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { name: '', password: '' },
  });

  const onSubmit = async (values: z.infer<typeof inviteSchema>) => {
    try {
      const { data } = await api.post('/invites/accept', { ...values, token });
      setToken(data.token);
      setUser(data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to accept invitation.');
    }
  };

  if (error) return <div className="hearth-page grid min-h-screen place-items-center bg-background p-8 text-center text-red-700 dark:text-red-300">{error}</div>;
  if (!inviteInfo) return <div className="hearth-page grid min-h-screen place-items-center bg-background p-8 text-center text-muted-foreground">Loading invitation…</div>;

  return (
    <AuthLayout
      eyebrow="A place at the table"
      title={<>The best home is<br /><span className="metallic-text">a shared decision.</span></>}
      description="Join the people you trust in one connected space for decisions, financials, tours, and every next step."
      image="https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1800&q=88"
    >
          <p className="hearth-eyebrow text-champagne">A shared home search</p>
          <h2 className="mt-4 font-sans text-4xl font-semibold tracking-[-0.045em]">You've been invited</h2>
          <p className="mt-3 text-sm leading-6 text-white/45">Join <strong className="text-white/75">{inviteInfo.group.name}</strong> to collaborate on the home search.</p>
          <div className="mt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs text-white/45">Invited email: <span className="text-white/70">{inviteInfo.invitedEmail}</span></div>
              <FormField
                control={form.control}
                name="name"
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" placeholder="Your full name" {...field} />
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
                    <FormLabel>Choose a Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" placeholder="Choose a secure password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="shimmer-button w-full rounded-xl bg-champagne text-[#11100d] hover:bg-white hover:text-[#11100d]">Accept &amp; join</Button>
            </form>
          </Form>
          </div>
    </AuthLayout>
  );
};

export default Invite;
