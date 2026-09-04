import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Home, ChevronLeft, Calendar, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/useAuthStore';
import { WeightedScoringPanel } from '@/components/decision/WeightedScoringPanel';
import { PropertyMap } from '@/components/property/PropertyMap';
import { FinancingPanel } from '@/components/property/FinancingPanel';

const toFormValue = (value: unknown) => value === undefined || value === null ? '' : String(value);

export const PropertyEditForm = ({ property, onSave, isSaving, error }: {
  property: any;
  onSave: (data: Record<string, string | number | null>) => void;
  isSaving: boolean;
  error: any;
}) => {
  const [pastedText, setPastedText] = useState('');
  const [formData, setFormData] = useState({
    address: toFormValue(property.address),
    city: toFormValue(property.city),
    state: toFormValue(property.state),
    zip: toFormValue(property.zip),
    price: toFormValue(property.price),
    beds: toFormValue(property.beds),
    baths: toFormValue(property.baths),
    sqft: toFormValue(property.sqft),
    yearBuilt: toFormValue(property.yearBuilt),
    lotSize: toFormValue(property.lotSize),
    propertyType: toFormValue(property.propertyType),
    hoa: toFormValue(property.hoa),
    mlsId: toFormValue(property.mlsId),
    description: toFormValue(property.description),
    sourceUrl: toFormValue(property.sourceUrl)
  });

  const parseTextMutation = useMutation({
    mutationFn: (text: string) => api.post('/properties/parse-text', { text }),
    onSuccess: ({ data }) => {
      setFormData((current) => {
        const updated = { ...current };
        Object.keys(updated).forEach((key) => {
          const value = data[key];
          if (value !== undefined && value !== null && value !== '') {
            updated[key as keyof typeof updated] = toFormValue(value);
          }
        });
        return updated;
      });
    }
  });

  const setField = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    const optionalNumber = (value: string) => value === '' ? null : Number(value);
    onSave({
      ...formData,
      price: optionalNumber(formData.price),
      beds: optionalNumber(formData.beds),
      baths: optionalNumber(formData.baths),
      sqft: optionalNumber(formData.sqft),
      yearBuilt: optionalNumber(formData.yearBuilt),
      lotSize: optionalNumber(formData.lotSize),
      hoa: optionalNumber(formData.hoa)
    });
  };

  return (
    <div className="space-y-5 pt-2">
      <div className="space-y-2 rounded-lg border bg-slate-50 p-3">
        <label className="text-xs font-semibold text-slate-600">Paste updated listing text</label>
        <Textarea
          className="min-h-24 bg-white font-mono text-xs"
          placeholder="Paste listing text here to update any details found in it..."
          value={pastedText}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPastedText(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!pastedText.trim() || parseTextMutation.isPending}
          onClick={() => parseTextMutation.mutate(pastedText)}
        >
          {parseTextMutation.isPending ? 'Extracting...' : 'Apply Pasted Details'}
        </Button>
        {parseTextMutation.isError && <p className="text-xs text-red-600">Could not extract details from that text.</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <label className="text-xs font-semibold text-slate-500">Address</label>
          <Input value={formData.address} onChange={(e) => setField('address', e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500">City</label>
          <Input value={formData.city} onChange={(e) => setField('city', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">State</label>
            <Input value={formData.state} onChange={(e) => setField('state', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500">Zip</label>
            <Input value={formData.zip} onChange={(e) => setField('zip', e.target.value)} />
          </div>
        </div>
        {([
          ['price', 'Price ($)', '1'], ['beds', 'Beds', '1'], ['baths', 'Baths', '0.5'],
          ['sqft', 'Sqft', '1'], ['yearBuilt', 'Year Built', '1'], ['lotSize', 'Lot Size (acres)', '0.01'],
          ['hoa', 'HOA ($/mo)', '1']
        ] as const).map(([field, label, step]) => (
          <div className="space-y-1" key={field}>
            <label className="text-xs font-semibold text-slate-500">{label}</label>
            <Input type="number" step={step} value={formData[field]} onChange={(e) => setField(field, e.target.value)} />
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500">Property Type</label>
          <Input value={formData.propertyType} onChange={(e) => setField('propertyType', e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500">MLS #</label>
          <Input value={formData.mlsId} onChange={(e) => setField('mlsId', e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-xs font-semibold text-slate-500">Listing URL</label>
          <Input value={formData.sourceUrl} onChange={(e) => setField('sourceUrl', e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-xs font-semibold text-slate-500">Description</label>
          <Textarea
            className="min-h-32"
            placeholder="Paste text or add another line to the listing..."
            value={formData.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setField('description', e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">Save failed: {error?.response?.data?.error || error.message}</p>}
      <DialogFooter>
        <Button onClick={handleSave} disabled={isSaving || !formData.address.trim()}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogFooter>
    </div>
  );
};

const PropertyDetail = () => {
  const { id } = useParams();
  useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [noteBody, setNoteBody] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [prosText, setProsText] = useState('');
  const [consText, setConsText] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data: property, isLoading, error: propertyError } = useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      const { data } = await api.get(`/properties/${id}`);
      return data;
    }
  });


  const { data: notes } = useQuery({
    queryKey: ['notes', id],
    queryFn: async () => {
      const { data } = await api.get(`/properties/${id}/notes`);
      return data;
    },
    enabled: !!property
  });

  useEffect(() => {
    setProsText(Array.isArray(property?.pros) ? property.pros.join('\n') : '');
    setConsText(Array.isArray(property?.cons) ? property.cons.join('\n') : '');
  }, [property?.id, property?.pros, property?.cons]);


  const addNoteMutation = useMutation({
    mutationFn: (newNote: any) => api.post(`/properties/${id}/notes`, newNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', id] });
      setNoteBody('');
      setVisitDate('');
    }
  });

  const saveProsConsMutation = useMutation({
    mutationFn: () => api.patch(`/properties/${id}`, {
      pros: prosText.split('\n').map((item) => item.trim()).filter(Boolean),
      cons: consText.split('\n').map((item) => item.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      queryClient.invalidateQueries({ queryKey: ['comparison'] });
    },
  });

  const editPropertyMutation = useMutation({
    mutationFn: (data: Record<string, string | number | null>) => api.patch(`/properties/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      setIsEditOpen(false);
    }
  });

  const deletePropertyMutation = useMutation({
    mutationFn: () => api.delete(`/properties/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.removeQueries({ queryKey: ['property', id] });
      navigate('/');
    }
  });

  if (isLoading) return <div className="p-8 text-center">Loading property...</div>;
  if (propertyError || !property) {
    return (
      <div className="space-y-4 p-8 text-center">
        <p className="text-red-600">
          Could not load property: {(propertyError as any)?.response?.data?.error || (propertyError as Error)?.message || 'Property not found'}
        </p>
        <Button variant="outline" asChild><Link to="/">Back to Search</Link></Button>
      </div>
    );
  }

  let photos: string[] = [];
  if (property.photos) {
    if (Array.isArray(property.photos)) {
      photos = property.photos;
    } else if (typeof property.photos === 'string') {
      try {
        const parsed = JSON.parse(property.photos);
        photos = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        photos = [property.photos];
      }
    }
  }

  const getHostname = (urlStr: string) => {
    try {
      const formatted = urlStr.startsWith('http') ? urlStr : `https://${urlStr}`;
      return new URL(formatted).hostname.replace('www.', '');
    } catch {
      return 'Listing Source';
    }
  };

  return (
    <div className="editorial-shell pb-16">
      <nav className="editorial-nav">
        <div className="editorial-container flex h-20 items-center">
          <Link to="/" className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-primary">
            <ChevronLeft className="w-5 h-5" />
            <span>Back to Search</span>
          </Link>
        </div>
      </nav>

      <main className="editorial-container space-y-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Photos & Basic Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="overflow-hidden border border-foreground/10 bg-background shadow-[0_24px_60px_-45px_rgba(44,39,34,0.6)]">
              {photos.length > 0 ? (
                <div className={`grid grid-cols-1 gap-1 ${photos.length > 1 ? 'md:grid-cols-2' : ''}`}>
                  <img src={photos[0]} alt="Primary" className="w-full h-[400px] object-cover" />
                  {photos.length > 1 && <div className="grid grid-cols-2 gap-1 h-[400px]">
                    {photos.slice(1, 5).map((p: string, i: number) => (
                      <img key={i} src={p} alt={`Photo ${i+2}`} className="w-full h-full object-cover" />
                    ))}
                    {photos.length > 5 && (
                      <div className="bg-slate-900/50 flex items-center justify-center text-white text-xl font-bold">
                        +{photos.length - 5}
                      </div>
                    )}
                  </div>}
                </div>
              ) : (
                <div className="w-full h-64 bg-slate-200 flex flex-col items-center justify-center text-slate-400">
                  <Home className="w-16 h-16 mb-2" />
                  <span>No photos available</span>
                </div>
              )}
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="eyebrow mb-3">Residence profile</p>
                    <h1 className="font-serif text-4xl font-medium leading-none md:text-5xl">{property.address}</h1>
                    <p className="mt-3 text-base text-muted-foreground">
                      {property.city ? `${property.city}, ${property.state || ''} ${property.zip || ''}` : `${property.state || ''} ${property.zip || ''}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-3xl font-medium text-primary">
                      {property.price ? `$${property.price.toLocaleString()}` : 'Price TBD'}
                    </p>
                    <p className="text-slate-500">MLS #{property.mlsId || 'N/A'}</p>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4 border-y border-foreground/10 py-5 sm:grid-cols-4">
                  <div className="text-center">
                    <p className="eyebrow">Beds</p>
                    <p className="mt-1 font-serif text-2xl font-medium">{property.beds != null ? property.beds : '--'}</p>
                  </div>
                  <div className="text-center">
                    <p className="eyebrow">Baths</p>
                    <p className="mt-1 font-serif text-2xl font-medium">{property.baths != null ? property.baths : '--'}</p>
                  </div>
                  <div className="text-center">
                    <p className="eyebrow">Sqft</p>
                    <p className="mt-1 font-serif text-2xl font-medium">{property.sqft != null ? property.sqft.toLocaleString() : '--'}</p>
                  </div>
                  <div className="text-center">
                    <p className="eyebrow">Year built</p>
                    <p className="mt-1 font-serif text-2xl font-medium">{property.yearBuilt != null ? property.yearBuilt : '--'}</p>
                  </div>
                </div>
                {property.description && (
                  <div className="mt-6">
                    <h2 className="text-xl font-bold mb-2">Description</h2>
                    <p className="text-slate-600 whitespace-pre-wrap">{property.description}</p>
                  </div>
                )}
              </div>
            </div>

            <PropertyMap
              address={property.address}
              city={property.city}
              state={property.state}
              zip={property.zip}
            />

            {property.price > 0 ? (
              <FinancingPanel price={property.price} hoa={property.hoa} state={property.state} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Financing examples</CardTitle>
                  <CardDescription>Add a listing price to see current rate benchmarks and illustrative loan payments.</CardDescription>
                </CardHeader>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Pros &amp; Cons</CardTitle>
                <CardDescription>Add one shared highlight or concern per line. These appear automatically in comparison.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-emerald-800">Pros</span>
                    <Textarea
                      aria-label="Property pros"
                      className="min-h-36"
                      placeholder={'Great natural light\nQuiet street\nUpdated kitchen'}
                      value={prosText}
                      onChange={(event) => setProsText(event.target.value)}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-rose-800">Cons</span>
                    <Textarea
                      aria-label="Property cons"
                      className="min-h-36"
                      placeholder={'Small backyard\nLong commute\nRoof needs work'}
                      value={consText}
                      onChange={(event) => setConsText(event.target.value)}
                    />
                  </label>
                </div>
                <div className="flex items-center justify-end gap-3">
                  {saveProsConsMutation.isSuccess && <span className="text-sm text-emerald-700">Saved</span>}
                  {saveProsConsMutation.isError && <span className="text-sm text-red-600">Could not save. Please try again.</span>}
                  <Button onClick={() => saveProsConsMutation.mutate()} disabled={saveProsConsMutation.isPending}>
                    {saveProsConsMutation.isPending ? 'Saving...' : 'Save Pros & Cons'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Notes Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" /> Team Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Textarea 
                    placeholder="Add a note (e.g., 'Loved the kitchen, but yard is small')" 
                    value={noteBody}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNoteBody(e.target.value)}
                  />
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Calendar className="w-4 h-4" />
                      <span>Visit Date (optional):</span>
                      <Input 
                        type="date" 
                        className="w-auto h-8 py-0" 
                        value={visitDate}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVisitDate(e.target.value)}
                      />
                    </div>
                    <Button 
                      className="sm:ml-auto" 
                      disabled={!noteBody || addNoteMutation.isPending}
                      onClick={() => addNoteMutation.mutate({ body: noteBody, visitDate: visitDate || null })}
                    >
                      Post Note
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  {notes?.length > 0 ? (
                    notes.map((note: any) => (
                      <div key={note.id} className="relative border border-foreground/10 bg-accent/40 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-sm">{note.author.name}</span>
                          <span className="text-xs text-slate-400">
                            {format(new Date(note.createdAt), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        {note.visitDate && (
                          <div className="text-xs text-primary font-medium mb-1">
                            Visited on {format(new Date(note.visitDate), 'MMM d, yyyy')}
                          </div>
                        )}
                        <p className="text-slate-700">{note.body}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-slate-400 py-8">No notes yet. Be the first to share your thoughts!</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Scoring & Actions */}
          <div className="space-y-6">
            <WeightedScoringPanel listingId={property.id} listingLabel={property.address} />

            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Property Type</span>
                  <span className="font-medium">{property.propertyType || 'Single Family'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">HOA</span>
                  <span className="font-medium">{property.hoa != null ? (property.hoa === 0 ? 'None' : `$${property.hoa}/mo`) : 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lot Size</span>
                  <span className="font-medium">{property.lotSize != null ? `${property.lotSize} acres` : 'TBD'}</span>
                </div>
                {property.sourceUrl && (
                  <Button variant="outline" className="w-full gap-2 mt-4" asChild>
                    <a href={property.sourceUrl} target="_blank" rel="noopener noreferrer">
                      View on {getHostname(property.sourceUrl)}
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manage Listing</CardTitle>
                <CardDescription>Update listing details or remove this property.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full gap-2">
                      <Pencil className="h-4 w-4" /> Edit Listing
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit Listing</DialogTitle>
                      <DialogDescription>Change individual fields, paste updated listing text, or add lines to the description.</DialogDescription>
                    </DialogHeader>
                    <PropertyEditForm
                      property={property}
                      onSave={(data) => editPropertyMutation.mutate(data)}
                      isSaving={editPropertyMutation.isPending}
                      error={editPropertyMutation.error}
                    />
                  </DialogContent>
                </Dialog>

                <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" className="w-full gap-2">
                      <Trash2 className="h-4 w-4" /> Delete Listing
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete this listing?</DialogTitle>
                      <DialogDescription>
                        This permanently removes {property.address}, including its notes, evaluations, and scores. This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    {deletePropertyMutation.isError && (
                      <p className="text-sm text-red-600">
                        Delete failed: {(deletePropertyMutation.error as any)?.response?.data?.error || deletePropertyMutation.error.message}
                      </p>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={deletePropertyMutation.isPending}>
                        Cancel
                      </Button>
                      <Button variant="destructive" onClick={() => deletePropertyMutation.mutate()} disabled={deletePropertyMutation.isPending}>
                        {deletePropertyMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PropertyDetail;
