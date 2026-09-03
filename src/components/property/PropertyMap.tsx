import { ExternalLink, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PropertyMapProps {
  address: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  compact?: boolean;
}

export function PropertyMap({ address, city, state, zip, compact = false }: PropertyMapProps) {
  const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');
  const encodedAddress = encodeURIComponent(fullAddress);
  const mapUrl = `https://www.google.com/maps?q=${encodedAddress}&output=embed`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;

  return (
    <section className="overflow-hidden border border-foreground/10 bg-background" aria-label={`Map for ${fullAddress}`}>
      <iframe
        src={mapUrl}
        title={`Google Map showing ${fullAddress}`}
        className={compact ? 'h-36 w-full border-0' : 'h-72 w-full border-0 md:h-80'}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      <div className={`flex items-center justify-between gap-3 ${compact ? 'p-3' : 'p-4'}`}>
        {!compact && (
          <div className="min-w-0">
            <p className="eyebrow mb-1">Location</p>
            <p className="truncate text-sm text-muted-foreground">{fullAddress}</p>
          </div>
        )}
        <Button asChild variant={compact ? 'ghost' : 'outline'} size="sm" className={compact ? 'w-full gap-2' : 'shrink-0 gap-2'}>
          <a href={directionsUrl} target="_blank" rel="noreferrer" aria-label={`Get directions to ${fullAddress}`}>
            <Navigation className="h-4 w-4" />
            Directions
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      </div>
    </section>
  );
}