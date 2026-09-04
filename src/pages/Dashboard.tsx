import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';
import { isTestMode } from '@/lib/authStorage';
import { Plus, Home, Users, Settings, LogOut, Pencil, Trash2, GitCompareArrows, ArrowRight, Sparkles, Search, ExternalLink } from 'lucide-react';
import { PropertyEditForm } from '@/pages/PropertyDetail';
import { PropertyMap } from '@/components/property/PropertyMap';
import { AdSlot } from '@/components/advertising/AdSlot';
import BrandLogo from '@/components/BrandLogo';

const getPrimaryPhoto = (photosData: any): string | null => {
  if (!photosData) return null;
  if (Array.isArray(photosData)) return photosData[0] || null;
  if (typeof photosData === 'string') {
    try {
      const parsed = JSON.parse(photosData);
      if (Array.isArray(parsed)) return parsed[0] || null;
      if (typeof parsed === 'string') return parsed;
    } catch {
      return photosData;
    }
  }
  return null;
};

const PropertyCard = ({ property, selected, onSelectedChange, onEdit, onDelete }: {
  property: any;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const photo = getPrimaryPhoto(property.photos);

  return (
      <Card className={`group overflow-hidden bg-background transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_24px_55px_-35px_rgba(44,39,34,0.55)] ${selected ? 'ring-1 ring-primary' : ''}`}>
        <div className="relative">
          <label className="absolute left-3 top-3 z-10 flex cursor-pointer items-center gap-2 rounded-sm bg-background/95 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] shadow-sm backdrop-blur">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={selected}
              onChange={(event) => onSelectedChange(event.target.checked)}
            />
            Select
          </label>
          <Link to={`/property/${property.id}`} aria-label={`View ${property.address}`}>
        {photo ? (
          <img src={photo} alt={property.address} className="h-64 w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-64 w-full items-center justify-center bg-accent">
            <Home className="h-12 w-12 text-muted-foreground/60" />
          </div>
        )}
          </Link>
        </div>
        <Link to={`/property/${property.id}`} className="block">
        <CardContent className="p-4">
          <p className="eyebrow mb-2">Shortlisted residence</p>
          <h3 className="truncate font-serif text-2xl font-medium">{property.address}</h3>
          <p className="text-sm text-muted-foreground">{property.city ? `${property.city}, ${property.state || ''}` : property.state || ''}</p>
          <div className="mt-4 flex items-end justify-between border-t border-foreground/10 pt-4">
            <span className="font-serif text-xl font-medium text-primary">
              {property.price ? `$${property.price.toLocaleString()}` : 'Price TBD'}
            </span>
            <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              {property.beds != null ? `${property.beds}bd` : '--bd'} | {property.baths != null ? `${property.baths}ba` : '--ba'} | {property.sqft != null ? `${property.sqft.toLocaleString()}sqft` : '--sqft'}
            </div>
          </div>
        </CardContent>
        </Link>
        <div className="px-4 pb-4">
          <PropertyMap
            address={property.address}
            city={property.city}
            state={property.state}
            zip={property.zip}
            compact
          />
        </div>
        <CardFooter className="p-4 pt-0 flex justify-between">
          <div className="flex -space-x-2">
             {/* Placeholder for avatars of people who scored it */}
             <div className="h-6 w-6 rounded-full border-2 border-background bg-secondary" />
             <div className="h-6 w-6 rounded-full border-2 border-background bg-primary/50" />
          </div>
          <div className="flex items-center gap-2">
            {property.hasVeto && (
              <Badge variant="destructive" className="h-6 px-2">VETO</Badge>
            )}
            <div className="border border-primary/25 bg-primary/5 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              Score: {property.score == null ? 'Pending' : `${Math.round(property.score)}%`}
            </div>
          </div>
        </CardFooter>
        <div className="flex gap-2 border-t p-3">
          <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button variant="destructive" size="sm" className="flex-1 gap-2" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </Card>
  );
};

const AddPropertyForm = ({ onSuccess, searchId }: { onSuccess: () => void; searchId: string }) => {
  const [url, setUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState('url');
  const queryClient = useQueryClient();

  const [manualData, setManualData] = useState({
    address: '',
    city: '',
    state: '',
    zip: '',
    price: '',
    beds: '',
    baths: '',
    sqft: '',
    yearBuilt: '',
    lotSize: '',
    propertyType: '',
    hoa: '',
    mlsId: '',
    description: '',
    photos: '',
    sourceUrl: '',
    latitude: '',
    longitude: ''
  });

  const [extractedSource, setExtractedSource] = useState<'url' | 'text' | null>(null);
  const [importMeta, setImportMeta] = useState<{ provider: string; completeness: number; warnings: string[]; cached: boolean } | null>(null);

  const populateExtractedData = (data: any, originalUrl?: string, source: 'url' | 'text' = 'url') => {
    setExtractedSource(source);
    setImportMeta(data.importMeta || null);
    setManualData({
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      zip: data.zip || '',
      price: data.price !== undefined && data.price !== null ? data.price.toString() : '',
      beds: data.beds !== undefined && data.beds !== null ? data.beds.toString() : '',
      baths: data.baths !== undefined && data.baths !== null ? data.baths.toString() : '',
      sqft: data.sqft !== undefined && data.sqft !== null ? data.sqft.toString() : '',
      yearBuilt: data.yearBuilt !== undefined && data.yearBuilt !== null ? data.yearBuilt.toString() : '',
      lotSize: data.lotSize !== undefined && data.lotSize !== null ? data.lotSize.toString() : '',
      propertyType: data.propertyType || '',
      hoa: data.hoa !== undefined && data.hoa !== null ? data.hoa.toString() : '',
      mlsId: data.mlsId || '',
      description: data.description || '',
      photos: data.photos ? (Array.isArray(data.photos) ? JSON.stringify(data.photos) : data.photos) : '',
      sourceUrl: data.sourceUrl || originalUrl || '',
      latitude: data.latitude !== undefined && data.latitude !== null ? data.latitude.toString() : '',
      longitude: data.longitude !== undefined && data.longitude !== null ? data.longitude.toString() : ''
    });
  };

  const importMutation = useMutation({
    mutationFn: (url: string) => api.post('/properties/import', { url }),
    onSuccess: (res) => {
      populateExtractedData(res.data, url, 'url');
      setActiveTab('manual');
    }
  });

  const parseTextMutation = useMutation({
    mutationFn: (text: string) => api.post('/properties/parse-text', { text }),
    onSuccess: (res) => {
      populateExtractedData(res.data, undefined, 'text');
      setActiveTab('manual');
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/properties', { ...data, searchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      onSuccess();
    }
  });

  const handleImport = async () => {
    setImporting(true);
    try {
      await importMutation.mutateAsync(url);
    } finally {
      setImporting(false);
    }
  };

  const handleParseText = async () => {
    setImporting(true);
    try {
      await parseTextMutation.mutateAsync(pastedText);
    } finally {
      setImporting(false);
    }
  };

  const handleCreate = () => {
    createMutation.mutate({
      address: manualData.address,
      city: manualData.city,
      state: manualData.state,
      zip: manualData.zip,
      price: manualData.price ? parseFloat(manualData.price) : null,
      beds: manualData.beds ? parseInt(manualData.beds) : null,
      baths: manualData.baths ? parseFloat(manualData.baths) : null,
      sqft: manualData.sqft ? parseFloat(manualData.sqft) : null,
      yearBuilt: manualData.yearBuilt ? parseInt(manualData.yearBuilt) : null,
      lotSize: manualData.lotSize ? parseFloat(manualData.lotSize) : null,
      propertyType: manualData.propertyType || null,
      hoa: manualData.hoa ? parseFloat(manualData.hoa) : null,
      mlsId: manualData.mlsId || null,
      description: manualData.description || null,
      photos: manualData.photos || null,
      sourceUrl: manualData.sourceUrl || url || null,
      latitude: manualData.latitude ? parseFloat(manualData.latitude) : null,
      longitude: manualData.longitude ? parseFloat(manualData.longitude) : null
    });
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="url">Import URL</TabsTrigger>
        <TabsTrigger value="text">Paste Text</TabsTrigger>
        <TabsTrigger value="manual">Manual</TabsTrigger>
      </TabsList>
      <TabsContent value="url" className="space-y-4 pt-4">
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Paste an approved Realtor.com, Zillow, or Redfin listing URL. The importer automatically tries configured extractors from most reliable to most compatible.</p>
          <div className="flex gap-2">
            <Input placeholder="https://www.realtor.com/realestateandhomes-detail/..." value={url} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)} />
            <Button onClick={handleImport} disabled={importing || !url}>
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </div>
        </div>
        {importMutation.isError && (
          <div className="p-4 bg-red-50 text-red-700 rounded text-sm">
            Import failed: {(importMutation.error as any)?.response?.data?.error || importMutation.error.message}
          </div>
        )}
      </TabsContent>
      <TabsContent value="text" className="space-y-4 pt-4">
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            Copy the text from the Realtor or Zillow page (e.g. select all with <kbd className="px-1 py-0.5 bg-slate-100 border rounded text-[10px]">Ctrl+A</kbd> / <kbd className="px-1 py-0.5 bg-slate-100 border rounded text-[10px]">Cmd+A</kbd>, copy, and paste below). All fields including beds, baths, sqft, price, lot, year, HOA, and address will be parsed.
          </p>
          <textarea 
            className="w-full min-h-[200px] p-3 text-sm border rounded-md font-mono"
            placeholder="Paste listing text or page contents here..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />
          <Button className="w-full" onClick={handleParseText} disabled={importing || !pastedText}>
            {importing ? 'Parsing...' : 'Extract All Details'}
          </Button>
        </div>
      </TabsContent>
      <TabsContent value="manual" className="pt-4 space-y-4">
        {(importMutation.isSuccess || parseTextMutation.isSuccess) && (
          <div>
            {manualData.beds && manualData.price ? (
              <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded text-sm flex items-center justify-between">
                <span>
                  Property details extracted{importMeta ? ` by ${importMeta.provider} (${importMeta.completeness}% complete${importMeta.cached ? ', cached' : ''})` : ''}. Please review and save below.
                </span>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded text-sm space-y-2">
                <div className="font-medium">
                  {extractedSource === 'url'
                    ? 'Address details imported from URL. Listing sites (Realtor/Zillow) may block automated server scraping of price & beds.'
                    : 'Partial details extracted.'}
                </div>
                <div className="text-xs text-amber-700">
                  You can complete the fields below manually, or switch to the <strong>Paste Text</strong> tab to paste the listing text for instant 100% extraction.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs border-amber-300 hover:bg-amber-100 text-amber-900"
                  onClick={() => setActiveTab('text')}
                >
                  Switch to Paste Text Tab
                </Button>
              </div>
            )}
          </div>
        )}
        {importMeta?.warnings.map((warning) => (
          <div key={warning} className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {warning}
          </div>
        ))}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="col-span-2 sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-slate-500">Address</label>
            <Input placeholder="123 Main St" value={manualData.address} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, address: e.target.value})} />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-semibold text-slate-500">City</label>
            <Input placeholder="City" value={manualData.city} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, city: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">State</label>
            <Input placeholder="ST" value={manualData.state} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, state: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Zip</label>
            <Input placeholder="12345" value={manualData.zip} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, zip: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Price ($)</label>
            <Input placeholder="Price" type="number" value={manualData.price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, price: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Beds</label>
            <Input placeholder="Beds" type="number" value={manualData.beds} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, beds: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Baths</label>
            <Input placeholder="Baths" type="number" step="0.5" value={manualData.baths} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, baths: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Sqft</label>
            <Input placeholder="Sqft" type="number" value={manualData.sqft} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, sqft: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Year Built</label>
            <Input placeholder="Year Built" type="number" value={manualData.yearBuilt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, yearBuilt: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Lot Size (Acres)</label>
            <Input placeholder="Lot Size" type="number" step="0.01" value={manualData.lotSize} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, lotSize: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">HOA ($/mo)</label>
            <Input placeholder="HOA" type="number" value={manualData.hoa} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, hoa: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Property Type</label>
            <Input placeholder="Single Family" value={manualData.propertyType} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, propertyType: e.target.value})} />
          </div>
          <div className="col-span-2 sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-slate-500">MLS #</label>
            <Input placeholder="MLS ID" value={manualData.mlsId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, mlsId: e.target.value})} />
          </div>
          <div className="col-span-2 sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-slate-500">Listing URL</label>
            <Input placeholder="https://..." type="url" value={manualData.sourceUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, sourceUrl: e.target.value})} />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-semibold text-slate-500">Latitude</label>
            <Input placeholder="34.0522" type="number" step="any" value={manualData.latitude} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, latitude: e.target.value})} />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-semibold text-slate-500">Longitude</label>
            <Input placeholder="-118.2437" type="number" step="any" value={manualData.longitude} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualData({...manualData, longitude: e.target.value})} />
          </div>
          <div className="col-span-2 sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-slate-500">Description</label>
            <Textarea placeholder="Property description..." value={manualData.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setManualData({...manualData, description: e.target.value})} />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <Button className="w-full" onClick={handleCreate} disabled={createMutation.isPending || !manualData.address}>
              {createMutation.isPending ? 'Saving...' : 'Save Property'}
            </Button>
          </div>
        </div>
        {createMutation.isError && (
          <div className="p-4 bg-red-50 text-red-700 rounded text-sm">
            Save failed: {(createMutation.error as any)?.response?.data?.error || createMutation.error.message}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};

const Dashboard = () => {
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set());
  const [editingProperty, setEditingProperty] = useState<any>(null);
  const [deletingProperties, setDeletingProperties] = useState<any[]>([]);
  const [activeSearchId, setActiveSearchId] = useState('');
  const [newSearchName, setNewSearchName] = useState('');
  const [isNewSearchOpen, setIsNewSearchOpen] = useState(false);

  const { data: searches = [] } = useQuery({
    queryKey: ['searches'],
    queryFn: async () => (await api.get('/searches')).data
  });
  const activeSearch = searches.find((search: any) => search.id === activeSearchId) ?? searches[0];
  const selectedSearchId = activeSearch?.id ?? '';

  const createSearchMutation = useMutation({
    mutationFn: (name: string) => api.post('/searches', { name }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['searches'] });
      setActiveSearchId(data.id);
      setNewSearchName('');
      setIsNewSearchOpen(false);
    }
  });

  const { data: properties, isLoading } = useQuery({
    queryKey: ['properties', selectedSearchId],
    enabled: Boolean(selectedSearchId),
    queryFn: async () => {
      const { data } = await api.get('/properties', { params: { searchId: selectedSearchId } });
      return data;
    }
  });

  const { data: rates } = useQuery({
    queryKey: ['rates'],
    queryFn: async () => {
      const { data } = await api.get('/rates');
      return data;
    }
  });

  const editPropertyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, string | number | null> }) => api.patch(`/properties/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties', selectedSearchId] });
      setEditingProperty(null);
    }
  });

  const deletePropertiesMutation = useMutation({
    mutationFn: (propertyIds: string[]) => Promise.all(propertyIds.map((id) => api.delete(`/properties/${id}`))),
    onSuccess: (_, propertyIds) => {
      queryClient.invalidateQueries({ queryKey: ['properties', selectedSearchId] });
      queryClient.invalidateQueries({ queryKey: ['searches'] });
      setSelectedPropertyIds((current) => {
        const next = new Set(current);
        propertyIds.forEach((id) => next.delete(id));
        return next;
      });
      setDeletingProperties([]);
    }
  });

  const selectProperty = (id: string, selected: boolean) => {
    setSelectedPropertyIds((current) => {
      const next = new Set(current);
      if (selected && next.size < 4) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectedProperties = properties?.filter((property: any) => selectedPropertyIds.has(property.id)) || [];

  const sendInvite = async () => {
    try {
      const { data } = await api.post('/invites', { email: inviteEmail, searchId: selectedSearchId });
      setInviteLink(data.inviteLink);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="editorial-shell pb-16">
      <nav className="editorial-nav">
        <div className="editorial-container flex h-20 items-center justify-between">
          <Link to="/dashboard" aria-label="Home Buyer Sync dashboard">
            <BrandLogo className="h-14 w-auto max-w-[12rem] sm:max-w-none" />
          </Link>
          <div className="hidden items-center gap-8 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-muted-foreground md:flex">
            <span className="text-foreground">Properties</span>
            <Link className="transition-colors hover:text-foreground" to="/checklist">Criteria</Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs uppercase tracking-[0.12em] text-muted-foreground md:inline">Signed in as {user?.name}</span>
            {isTestMode && (
              <Button variant="outline" size="sm" className="hidden gap-2 sm:flex" onClick={() => window.open('/login', '_blank', 'noopener,noreferrer')}>
                <ExternalLink className="h-4 w-4" /> Another user
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={logout} title="Logout">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="ad-dashboard-layout">
      <div className="ad-side-rail"><AdSlot placement="left" /></div>
      <main className="editorial-container space-y-10 py-6 md:py-10">
        <section className="space-y-4 border-b border-foreground/10 pb-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="eyebrow flex items-center gap-2"><Search className="h-3.5 w-3.5" /> Your searches</p><p className="mt-2 text-sm text-muted-foreground">Choose an area of interest and see everyone contributing to it.</p></div>
            <Button variant="outline" className="gap-2" onClick={() => setIsNewSearchOpen(true)}><Plus className="h-4 w-4" /> New search</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {searches.map((search: any) => (
              <button
                key={search.id}
                type="button"
                className={`p-4 text-left transition-colors ${search.id === selectedSearchId ? 'border border-primary bg-primary/5' : 'border border-foreground/10 bg-background/70 hover:border-primary/40'}`}
                onClick={() => {
                  setActiveSearchId(search.id);
                  setSelectedPropertyIds(new Set());
                }}
              >
                <span className="flex items-start justify-between gap-3"><span className="font-serif text-2xl font-medium">{search.name}</span><span className="text-xs uppercase tracking-wider text-muted-foreground">{search.propertyCount} homes</span></span>
                <span className="mt-3 flex flex-wrap gap-2">
                  {search.contributors.map((contributor: any) => (
                    <span key={contributor.id} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={contributor.email}>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">{contributor.name.charAt(0).toUpperCase()}</span>
                      {contributor.name}{contributor.id === user?.id ? ' (you)' : ''}
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </section>

        <Dialog open={isNewSearchOpen} onOpenChange={setIsNewSearchOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a named search</DialogTitle><DialogDescription>Use a unique name for an area or buying goal, such as “North Shore” or “Downtown condos”.</DialogDescription></DialogHeader>
            <Input value={newSearchName} onChange={(event) => setNewSearchName(event.target.value)} placeholder="Search name" maxLength={80} />
            {createSearchMutation.isError && <p className="text-sm text-red-600">{(createSearchMutation.error as any)?.response?.data?.error || 'Could not create search'}</p>}
            <DialogFooter><Button onClick={() => createSearchMutation.mutate(newSearchName.trim())} disabled={!newSearchName.trim() || createSearchMutation.isPending}>{createSearchMutation.isPending ? 'Creating…' : 'Create search'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <div
          className="dashboard-hero flex flex-col justify-between gap-12 p-6 md:p-10 lg:p-12"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2000&q=88')" }}
        >
          <div className="flex items-center justify-between">
            <span className="glass-label"><Sparkles className="h-3.5 w-3.5" /> Your next chapter</span>
            <span className="hidden text-[0.62rem] uppercase tracking-[0.2em] text-white/65 sm:block">Curate · Compare · Decide</span>
          </div>
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="mb-4 text-[0.68rem] font-medium uppercase tracking-[0.28em] text-white/65">A considered collection</p>
              <h1 className="font-serif text-5xl font-medium leading-[0.9] tracking-[-0.04em] md:text-7xl">Make room for<br /><em>what comes next.</em></h1>
              <p className="mt-6 max-w-lg text-sm leading-6 text-white/75">Bring every listing and perspective into focus, then choose the home that feels right for everyone.</p>
            </div>
            <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
              {rates?.length > 0 && (
                <div className="border border-white/20 bg-black/15 px-4 py-3 text-xs text-white backdrop-blur-md">
                  <div className="flex gap-4">
                    {rates.map((r: any) => (
                      <div key={r.id} className="flex gap-2">
                        <span className="uppercase tracking-wider text-white/65">{r.rateType}</span>
                        <span className="font-semibold text-white">{r.rate}%</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1 text-[0.6rem] text-white/55">Latest available PMMS benchmarks · rates may change</p>
                </div>
              )}
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-white text-foreground hover:bg-white/90">
                    <Plus className="w-4 h-4" /> Add a home <ArrowRight className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add a Property</DialogTitle>
                  </DialogHeader>
                  <AddPropertyForm searchId={selectedSearchId} onSuccess={() => setIsAddDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {properties?.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-y border-foreground/10 bg-background/50 py-4">
            <Button variant="outline" size="sm" onClick={() => setSelectedPropertyIds(new Set(properties.map((property: any) => property.id)))}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedPropertyIds(new Set())} disabled={selectedPropertyIds.size === 0}>
              Select None
            </Button>
            <span className="mr-auto text-xs uppercase tracking-[0.1em] text-muted-foreground">{selectedProperties.length} selected · choose 2–4 to compare</span>
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              disabled={selectedProperties.length < 2 || selectedProperties.length > 4}
              asChild={selectedProperties.length >= 2 && selectedProperties.length <= 4}
            >
              {selectedProperties.length >= 2 && selectedProperties.length <= 4 ? (
                <Link to={`/compare?ids=${selectedProperties.map((property: any) => property.id).join(',')}`}>
                  <GitCompareArrows className="h-4 w-4" /> Compare
                </Link>
              ) : (
                <span><GitCompareArrows className="h-4 w-4" /> Compare</span>
              )}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              disabled={selectedProperties.length === 0}
              onClick={() => setDeletingProperties(selectedProperties)}
            >
              <Trash2 className="h-4 w-4" /> Delete Selected
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <Card key={i} className="h-80 animate-pulse bg-slate-200" />
            ))
          ) : properties?.length > 0 ? (
            [...properties].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map((p: any) => (
              <PropertyCard
                key={p.id}
                property={p}
                selected={selectedPropertyIds.has(p.id)}
                onSelectedChange={(selected) => selectProperty(p.id, selected)}
                onEdit={() => setEditingProperty(p)}
                onDelete={() => setDeletingProperties([p])}
              />
            ))
          ) : (
            <Card className="col-span-full p-12 flex flex-col items-center justify-center text-center border-dashed">
              <Home className="w-12 h-12 text-slate-300 mb-4" />
              <CardTitle>No properties yet</CardTitle>
              <CardDescription className="mt-2 mb-6">
                Start by adding a property manually or importing from a URL.
              </CardDescription>
              <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Add Your First Property
              </Button>
            </Card>
          )}
        </div>

        <Dialog open={Boolean(editingProperty)} onOpenChange={(open) => !open && setEditingProperty(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Listing</DialogTitle>
              <DialogDescription>Change individual fields, paste updated listing text, or add lines to the description.</DialogDescription>
            </DialogHeader>
            {editingProperty && (
              <PropertyEditForm
                key={editingProperty.id}
                property={editingProperty}
                onSave={(data) => editPropertyMutation.mutate({ id: editingProperty.id, data })}
                isSaving={editPropertyMutation.isPending}
                error={editPropertyMutation.error}
              />
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={deletingProperties.length > 0} onOpenChange={(open) => !open && setDeletingProperties([])}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {deletingProperties.length === 1 ? 'this listing' : `${deletingProperties.length} listings`}?</DialogTitle>
              <DialogDescription>
                {deletingProperties.length === 1
                  ? `This permanently removes ${deletingProperties[0]?.address}, including its notes, evaluations, and scores.`
                  : 'This permanently removes all selected listings, including their notes, evaluations, and scores.'}
                {' '}This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {deletePropertiesMutation.isError && (
              <p className="text-sm text-red-600">
                Delete failed: {(deletePropertiesMutation.error as any)?.response?.data?.error || deletePropertiesMutation.error.message}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingProperties([])} disabled={deletePropertiesMutation.isPending}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deletePropertiesMutation.isPending}
                onClick={() => deletePropertiesMutation.mutate(deletingProperties.map((property) => property.id))}
              >
                {deletePropertiesMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" /> Collaborate
              </CardTitle>
              <CardDescription>Invite co-buyers or your agent to join {activeSearch?.name || 'this search'}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Email address" 
                  value={inviteEmail} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteEmail(e.target.value)} 
                />
                <Button onClick={sendInvite}>Invite</Button>
              </div>
              {inviteLink && (
                <div className="p-3 bg-slate-100 rounded text-xs break-all border">
                  <strong>Link:</strong> {inviteLink}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" /> Search Criteria
              </CardTitle>
              <CardDescription>Manage shared must-haves and weighted preferences.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/checklist">Edit Criteria & Weights</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <div className="ad-side-rail"><AdSlot placement="right" /></div>
      </div>
      <div className="editorial-container pb-4"><AdSlot placement="bottom" /></div>
    </div>
  );
};

export default Dashboard;
