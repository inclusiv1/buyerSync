import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { DecisionCriteriaManager } from '@/components/decision/DecisionCriteriaManager';
import ClientHeader from '@/components/navigation/ClientHeader';

const PROPERTY_TYPES = ['Single Family', 'Condo', 'Townhouse', 'Manufactured', 'Multi-Family', 'Apartment', 'Land'];

const Checklist = () => {
  const queryClient = useQueryClient();
  const [showMore, setShowMore] = useState(false);

  const { data: criteria } = useQuery({
    queryKey: ['search-criteria'],
    queryFn: async () => {
      const { data } = await api.get('/search-criteria');
      return data;
    }
  });

  const updateCriteriaMutation = useMutation({
    mutationFn: (data: any) => api.post('/search-criteria', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-criteria'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property-decision'] });
    }
  });


  const handleSaveCriteria = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: any = {};
    formData.forEach((value, key) => {
      if (key === 'propertyTypes') return;
      if (value) {
        if (key === 'location' || key === 'status') {
          data[key] = value as string;
        } else if (key === 'minBeds' || key === 'yearBuiltMin' || key === 'yearBuiltMax' || key === 'schoolRating' || key === 'daysOld') {
          data[key] = parseInt(value as string);
        } else {
          data[key] = parseFloat(value as string);
        }
      } else {
        data[key] = null;
      }
    });
    const propertyTypes = formData.getAll('propertyTypes') as string[];
    data.propertyTypes = propertyTypes.length ? propertyTypes : null;
    updateCriteriaMutation.mutate(data);
  };

  return (
    <div className="client-theme hearth-page min-h-screen pb-16 text-foreground">
      <ClientHeader active="decisions" />

      <main className="mx-auto max-w-5xl space-y-8 px-5 py-10 md:px-10 md:py-16">
        <div className="border-b border-foreground/10 pb-10">
          <p className="hearth-eyebrow mb-4 text-violet-300">01 · Decisions</p>
          <h1 className="font-sans text-4xl font-semibold tracking-[-0.045em] md:text-6xl">Search criteria</h1>
          <p className="mt-4 text-muted-foreground">Define shared must-haves and weighted preferences in one collaborative scoring system.</p>
        </div>

        <DecisionCriteriaManager />

        <Card>
          <CardHeader>
            <CardTitle>Must-Have Filters</CardTitle>
            <CardDescription>Core requirements for your search.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveCriteria} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2 sm:col-span-2 md:col-span-4">
                  <label className="text-xs font-bold uppercase text-slate-500">Location (City, State or ZIP)</label>
                  <Input
                    name="location"
                    type="text"
                    placeholder="e.g. Smyrna, GA or 30080"
                    defaultValue={criteria?.location}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Min Price</label>
                  <Input 
                    name="minPrice"
                    type="number" 
                    placeholder="0" 
                    defaultValue={criteria?.minPrice} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Max Price</label>
                  <Input 
                    name="maxPrice"
                    type="number" 
                    placeholder="Any" 
                    defaultValue={criteria?.maxPrice}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Min Beds</label>
                  <Input 
                    name="minBeds"
                    type="number" 
                    placeholder="0" 
                    defaultValue={criteria?.minBeds}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500">Min Baths</label>
                  <Input 
                    name="minBaths"
                    type="number" 
                    step="0.5"
                    placeholder="0" 
                    defaultValue={criteria?.minBaths}
                  />
                </div>
              </div>
              <div className="flex justify-start">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowMore((current) => !current)}>
                  {showMore ? 'Show fewer criteria' : 'Show more criteria'}
                </Button>
              </div>
              {showMore && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-500">Radius (miles)</label>
                      <Input
                        name="radius"
                        type="number"
                        min="1"
                        max="100"
                        placeholder="e.g. 10"
                        defaultValue={criteria?.radius}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-500">Listing Status</label>
                      <select
                        name="status"
                        defaultValue={criteria?.status ?? 'Active'}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-500">Max Days on Market</label>
                      <Input
                        name="daysOld"
                        type="number"
                        min="1"
                        placeholder="Any"
                        defaultValue={criteria?.daysOld}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-500">Min Sqft</label>
                      <Input 
                        name="minSqft"
                        type="number" 
                        placeholder="0" 
                        defaultValue={criteria?.minSqft}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-500">Max Sqft</label>
                      <Input
                        name="maxSqft"
                        type="number"
                        placeholder="Any"
                        defaultValue={criteria?.maxSqft}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-500">Lot Size Min (sqft)</label>
                      <Input
                        name="lotSizeMin"
                        type="number"
                        placeholder="0"
                        defaultValue={criteria?.lotSizeMin}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-500">Lot Size Max (sqft)</label>
                      <Input
                        name="lotSizeMax"
                        type="number"
                        placeholder="Any"
                        defaultValue={criteria?.lotSizeMax}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-500">Max HOA</label>
                      <Input 
                        name="hoaMax"
                        type="number" 
                        placeholder="Any" 
                        defaultValue={criteria?.hoaMax}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-500">Year Built (Min)</label>
                      <Input 
                        name="yearBuiltMin"
                        type="number" 
                        placeholder="e.g. 1990" 
                        defaultValue={criteria?.yearBuiltMin}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-500">Year Built (Max)</label>
                      <Input
                        name="yearBuiltMax"
                        type="number"
                        placeholder="e.g. 2020"
                        defaultValue={criteria?.yearBuiltMax}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-500">School Rating (Min)</label>
                      <Input 
                        name="schoolRating"
                        type="number" 
                        min="1"
                        max="10"
                        placeholder="1-10" 
                        defaultValue={criteria?.schoolRating}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500">Property Types</label>
                    <div className="flex flex-wrap gap-3">
                      {PROPERTY_TYPES.map((type) => (
                        <label key={type} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="propertyTypes"
                            value={type}
                            defaultChecked={criteria?.propertyTypes?.includes(type)}
                          />
                          {type}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={updateCriteriaMutation.isPending}>
                  {updateCriteriaMutation.isPending ? 'Saving...' : 'Save Search Criteria'}
                </Button>
              </div>
              {updateCriteriaMutation.isSuccess && <p className="text-right text-sm text-emerald-300" role="status">Criteria saved. Property assessments have been refreshed.</p>}
              {updateCriteriaMutation.isError && <p className="text-right text-sm text-red-300" role="alert">Criteria could not be saved. Please try again.</p>}
            </form>
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default Checklist;
