import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/store/useAuthStore';
import api, { resolveApiAssetUrl } from '@/lib/api';

const emptyCampaign = { name: '', headline: '', body: '', imageUrl: '', destinationUrl: '', placement: 'any', startsAt: '', endsAt: '' };

const AdvertisingPortal = ({ admin = false }: { admin?: boolean }) => {
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyCampaign);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const authorized = admin ? user?.role === 'admin' : user?.role === 'advertiser';
  const endpoint = admin ? '/admin/campaigns' : '/advertiser/campaigns';
  const { data: campaigns = [] } = useQuery<any[]>({ queryKey: ['campaigns', admin], queryFn: async () => (await api.get(endpoint)).data, enabled: authorized });
  const createCampaign = useMutation({
    mutationFn: () => editingId ? api.patch(`/advertiser/campaigns/${editingId}`, form) : api.post('/advertiser/campaigns', form),
    onSuccess: () => { setForm(emptyCampaign); setEditingId(null); setError(''); queryClient.invalidateQueries({ queryKey: ['campaigns'] }); },
    onError: (requestError: any) => setError(requestError.response?.data?.error || 'Could not save campaign'),
  });
  const uploadCreative = useMutation({
    mutationFn: async (file: File) => {
      const data = new FormData();
      data.append('image', file);
      return api.post('/advertiser/creative-upload', data);
    },
    onSuccess: response => { setForm(current => ({ ...current, imageUrl: response.data.imageUrl })); setError(''); },
    onError: (requestError: any) => setError(requestError.response?.data?.error || 'Could not upload image'),
  });
  const update = useMutation({
    mutationFn: ({ id, data, action }: any) => action === 'submit' ? api.post(`/advertiser/campaigns/${id}/submit`) : api.patch(`/admin/campaigns/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  if (!user) return <div className="p-10 text-center">Loading account…</div>;
  if (!authorized) return <div className="p-10 text-center"><p>This area requires an {admin ? 'administrator' : 'advertiser'} account.</p><Button asChild className="mt-4"><Link to={admin ? '/login' : '/advertise/signup'}>{admin ? 'Sign in' : 'Create advertiser account'}</Link></Button></div>;

  return (
    <div className="editorial-shell min-h-screen">
      <nav className="editorial-nav"><div className="editorial-container flex h-20 items-center justify-between"><Link to="/" className="font-serif text-3xl">BuyerSync</Link><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{user.name}</span><Button variant="outline" size="sm" onClick={logout}>Sign out</Button></div></div></nav>
      <main className="editorial-container space-y-8 py-10">
        <header><p className="eyebrow">{admin ? 'Campaign operations' : 'Advertising studio'}</p><h1 className="display-title mt-3">{admin ? 'Review campaigns' : 'Reach home buyers thoughtfully'}</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">{admin ? 'Confirm invoicing and approve only campaigns that are ready to appear.' : 'Create a campaign, submit it for review, and contact BuyerSync to complete manual invoicing. Reporting updates as your ad runs.'}</p></header>
        {!admin && <Card><CardHeader><CardTitle>{editingId ? 'Edit campaign' : 'New campaign'}</CardTitle></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-2">
          <Input placeholder="Internal campaign name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
          <Input placeholder="Ad headline" maxLength={80} value={form.headline} onChange={event => setForm({ ...form, headline: event.target.value })} />
          <Textarea className="md:col-span-2" placeholder="Ad copy" maxLength={240} value={form.body} onChange={event => setForm({ ...form, body: event.target.value })} />
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input type="url" aria-label="Image URL" placeholder="https://… image URL" value={form.imageUrl} onChange={event => setForm({ ...form, imageUrl: event.target.value })} />
              <Button asChild type="button" variant="outline" className="shrink-0">
                <label className="cursor-pointer">{uploadCreative.isPending ? 'Uploading…' : 'Upload photo'}<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploadCreative.isPending} onChange={event => { const file = event.target.files?.[0]; if (file) uploadCreative.mutate(file); event.target.value = ''; }} /></label>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, or GIF up to 5 MB. You can also paste a public HTTPS image URL.</p>
            {form.imageUrl && <img src={resolveApiAssetUrl(form.imageUrl)} alt="Ad creative preview" className="h-32 w-full rounded-sm object-cover" />}
          </div>
          <Input type="url" placeholder="https://… destination URL" value={form.destinationUrl} onChange={event => setForm({ ...form, destinationUrl: event.target.value })} />
          <select className="h-10 border bg-background px-3 text-sm" value={form.placement} onChange={event => setForm({ ...form, placement: event.target.value })}><option value="any">Any placement</option><option value="left">Left rail</option><option value="right">Right rail</option><option value="bottom">Bottom rail</option></select>
          <div className="grid grid-cols-2 gap-2"><Input type="date" aria-label="Start date" value={form.startsAt} onChange={event => setForm({ ...form, startsAt: event.target.value })} /><Input type="date" aria-label="End date" value={form.endsAt} onChange={event => setForm({ ...form, endsAt: event.target.value })} /></div>
        </div>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<div className="mt-4 flex gap-2"><Button onClick={() => createCampaign.mutate()} disabled={createCampaign.isPending}>{editingId ? 'Update draft' : 'Save draft'}</Button>{editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(emptyCampaign); }}>Cancel</Button>}</div></CardContent></Card>}
        <section className="grid gap-5">
          {campaigns.map(campaign => <Card key={campaign.id}><CardContent className="grid gap-5 p-5 md:grid-cols-[9rem_1fr_auto] md:items-center">
            <img src={resolveApiAssetUrl(campaign.imageUrl)} alt="" className="h-28 w-full object-cover" />
            <div><p className="eyebrow">{campaign.placement} · {campaign.status} · {campaign.paymentStatus}</p><h2 className="mt-2 font-serif text-2xl">{campaign.headline}</h2><p className="mt-1 text-sm text-muted-foreground">{campaign.body}</p>{campaign.advertiser && <p className="mt-2 text-xs">{campaign.advertiser.name} · {campaign.advertiser.email}</p>}{campaign.rejectionReason && <p className="mt-2 text-sm text-red-600">Reason: {campaign.rejectionReason}</p>}<p className="mt-3 text-xs uppercase tracking-wider">{campaign.impressions} impressions · {campaign.clicks} clicks · {campaign.impressions ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2) : '0.00'}% CTR</p></div>
            {admin ? <AdminControls campaign={campaign} onSave={(data: any) => update.mutate({ id: campaign.id, data })} /> : <div className="grid gap-2"><Button variant="outline" onClick={() => { setEditingId(campaign.id); setForm({ name: campaign.name, headline: campaign.headline, body: campaign.body, imageUrl: campaign.imageUrl, destinationUrl: campaign.destinationUrl, placement: campaign.placement, startsAt: campaign.startsAt?.slice(0, 10) || '', endsAt: campaign.endsAt?.slice(0, 10) || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</Button><Button variant="outline" disabled={!['draft', 'rejected', 'paused'].includes(campaign.status) || update.isPending} onClick={() => update.mutate({ id: campaign.id, action: 'submit' })}>Submit for review</Button></div>}
          </CardContent></Card>)}
          {!campaigns.length && <p className="border border-dashed p-10 text-center text-sm text-muted-foreground">No campaigns yet.</p>}
        </section>
      </main>
    </div>
  );
};

const AdminControls = ({ campaign, onSave }: { campaign: any; onSave: (data: any) => void }) => {
  const [status, setStatus] = useState(campaign.status);
  const [paymentStatus, setPaymentStatus] = useState(campaign.paymentStatus);
  const [rejectionReason, setRejectionReason] = useState(campaign.rejectionReason || '');
  return <div className="grid min-w-48 gap-2"><select className="h-9 border bg-background px-2 text-sm" value={status} onChange={event => setStatus(event.target.value)}>{['draft', 'pending', 'approved', 'rejected', 'paused'].map(value => <option key={value}>{value}</option>)}</select><select className="h-9 border bg-background px-2 text-sm" value={paymentStatus} onChange={event => setPaymentStatus(event.target.value)}>{['pending', 'invoiced', 'paid', 'waived'].map(value => <option key={value}>{value}</option>)}</select>{status === 'rejected' && <Input placeholder="Rejection reason" value={rejectionReason} onChange={event => setRejectionReason(event.target.value)} />}<Button size="sm" onClick={() => onSave({ status, paymentStatus, rejectionReason })}>Save review</Button></div>;
};

export default AdvertisingPortal;