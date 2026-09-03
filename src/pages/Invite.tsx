import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

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

  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!inviteInfo) return <div className="p-8 text-center">Loading invitation...</div>;

  return (
    <div className="editorial-shell flex min-h-screen items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md bg-background">
        <CardHeader>
          <p className="eyebrow mb-3">A shared home search</p>
          <CardTitle className="text-4xl">You've been invited</CardTitle>
          <CardDescription>
            Join <strong>{inviteInfo.group.name}</strong> to collaborate on the home search.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="text-sm font-medium text-slate-500">Email: {inviteInfo.invitedEmail}</div>
              <FormField
                control={form.control}
                name="name"
                render={({ field }: any) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} />
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
                      <Input type="password" placeholder="******" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">Accept & Join</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Invite;
