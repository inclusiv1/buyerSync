import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ChevronLeft } from 'lucide-react';
import api from '@/lib/api';
import { DecisionCriteriaManager } from '@/components/decision/DecisionCriteriaManager';

const Checklist = () => {
  const queryClient = useQueryClient();

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
    }
  });


  const handleSaveCriteria = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: any = {};
    formData.forEach((value, key) => {
      if (value) {
        if (key === 'minBeds' || key === 'yearBuiltMin' || key === 'yearBuiltMax' || key === 'schoolRating') {
          data[key] = parseInt(value as string);
        } else {
          data[key] = parseFloat(value as string);
        }
      } else {
        data[key] = null;
      }
    });
    updateCriteriaMutation.mutate(data);
  };

  return (
    <div className="editorial-shell pb-16">
      <nav className="editorial-nav">
        <div className="mx-auto flex h-20 max-w-5xl items-center px-5 md:px-10">
          <Link to="/" className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-primary">
            <ChevronLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl space-y-8 px-5 py-10 md:px-10 md:py-16">
        <div className="border-b border-foreground/10 pb-10">
          <p className="eyebrow mb-4">Shape the search</p>
          <h1 className="display-title">Search criteria</h1>
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
              <div className="flex justify-end">
                <Button type="submit" disabled={updateCriteriaMutation.isPending}>
                  {updateCriteriaMutation.isPending ? 'Saving...' : 'Save Search Criteria'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default Checklist;
