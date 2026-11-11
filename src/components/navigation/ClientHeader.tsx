import { useState } from 'react';
import { ExternalLink, LogOut, Phone, MessageSquare, Check, User as UserIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import ProductAreaTabs, { type ProductArea } from '@/components/navigation/ProductAreaTabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { isTestMode } from '@/lib/authStorage';
import { useAuthStore } from '@/store/useAuthStore';
import { useThemeStore } from '@/store/useThemeStore';
import api from '@/lib/api';

export default function ClientHeader({ active = 'decisions', onAreaSelect }: {
  active?: ProductArea;
  onAreaSelect?: (area: ProductArea) => void;
}) {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuthStore();
  const theme = useThemeStore(state => state.theme);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [phone, setPhone] = useState(user?.phone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectArea = (area: ProductArea) => {
    if (onAreaSelect) onAreaSelect(area);
    else navigate(`/?area=${area}#workspace`);
  };

  const handleOpenProfile = (open: boolean) => {
    setIsProfileOpen(open);
    if (open) {
      setPhone(user?.phone || '');
      setSaveSuccess(false);
      setSaveError(null);
    }
  };

  const handleSavePhone = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const { data } = await api.patch('/me/profile', { phone: phone.trim() || null });
      setUser(data);
      setSaveSuccess(true);
      setTimeout(() => {
        setIsProfileOpen(false);
      }, 1000);
    } catch (err: any) {
      setSaveError(err.response?.data?.error || 'Failed to update phone number.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <header className="client-nav sticky top-0 z-40 border-b border-foreground/10 bg-background/90 backdrop-blur-2xl">
      <div className="editorial-container flex h-16 items-center justify-between gap-4">
        <Link to="/" aria-label="Home Buyer Sync workspace" className="shrink-0">
          <BrandLogo variant={theme === 'dark' ? 'on-dark' : 'default'} className="h-10 w-auto sm:h-11" />
        </Link>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Dialog open={isProfileOpen} onOpenChange={handleOpenProfile}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-xl border border-foreground/15 px-3 py-1.5 text-xs transition hover:border-primary/50 hover:bg-accent hover:text-foreground"
                title="Account & SMS messaging settings"
              >
                <UserIcon className="h-3.5 w-3.5 text-primary" />
                <span className="hidden font-medium text-foreground sm:inline">{user?.name}</span>
                {user?.phone ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <MessageSquare className="h-2.5 w-2.5" /> SMS Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400">
                    + Phone
                  </span>
                )}
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-primary" /> Profile &amp; Messaging Settings
                </DialogTitle>
                <DialogDescription>
                  Link your mobile number to receive instant listing alerts with effects, score updates, and interactive text search.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="rounded-lg border border-foreground/10 bg-muted/40 p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account</span>
                    <span className="font-semibold text-foreground">{user?.name}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="text-foreground">{user?.email}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <span className="capitalize text-primary">{user?.role?.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">Mobile Phone Number</label>
                    <span className="text-[10px] text-muted-foreground">US or E.164</span>
                  </div>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="(555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Connects your account to Linq iMessage/SMS services. Text <code className="rounded bg-muted px-1 text-primary">status</code>, <code className="rounded bg-muted px-1 text-primary">top</code>, or <code className="rounded bg-muted px-1 text-primary">search</code> from this number at any time.
                  </p>
                </div>

                {saveSuccess && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <Check className="h-4 w-4" /> Phone number updated successfully!
                  </div>
                )}

                {saveError && (
                  <p className="text-xs text-red-600">{saveError}</p>
                )}
              </div>

              <DialogFooter className="flex sm:justify-between">
                <Button variant="outline" type="button" onClick={() => setIsProfileOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSavePhone} disabled={isSaving}>
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex items-center gap-1.5" title="Advertising Studio">
            <Link to="/advertise">
              <span>Ads Studio</span>
            </Link>
          </Button>

          {isTestMode && <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => window.open('/login', '_blank', 'noopener,noreferrer')}><ExternalLink /> Another user</Button>}
          <button type="button" onClick={logout} className="grid h-9 w-9 place-items-center rounded-xl border border-foreground/15 transition hover:border-primary/50 hover:bg-accent hover:text-foreground" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="editorial-container pb-2">
        <ProductAreaTabs active={active} onSelect={selectArea} compact />
      </div>
    </header>
  );
}