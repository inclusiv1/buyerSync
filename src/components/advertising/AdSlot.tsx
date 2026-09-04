import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api, { resolveApiAssetUrl } from '@/lib/api';

type Placement = 'left' | 'right' | 'bottom';

interface CampaignAd {
  id: string;
  headline: string;
  body: string;
  imageUrl: string;
  destinationUrl: string;
}

interface NetworkConfig {
  enabled: boolean;
  scriptUrl: string | null;
  publisherId: string | null;
  slots: Record<Placement, string | null>;
}

const loadedScripts = new Set<string>();

const ContextualSlot = ({ placement, config }: { placement: Placement; config: NetworkConfig }) => {
  const slot = config.slots[placement];

  useEffect(() => {
    if (!config.enabled || !config.scriptUrl || loadedScripts.has(config.scriptUrl)) return;
    loadedScripts.add(config.scriptUrl);
    const script = document.createElement('script');
    script.async = true;
    script.src = config.scriptUrl;
    script.dataset.publisher = config.publisherId || '';
    document.head.appendChild(script);
  }, [config]);

  if (!config.enabled || !slot) return null;
  return <div className="contextual-ad-slot min-h-24" data-ad-publisher={config.publisherId || ''} data-ad-slot={slot} data-ad-placement={placement} />;
};

export const AdSlot = ({ placement }: { placement: Placement }) => {
  const { data: campaign } = useQuery<CampaignAd | null>({
    queryKey: ['ad', placement],
    queryFn: async () => (await api.get(`/ads/serve?placement=${placement}`)).data,
    staleTime: 5 * 60 * 1000,
  });
  const { data: config } = useQuery<NetworkConfig>({
    queryKey: ['ad-network-config'],
    queryFn: async () => (await api.get('/ads/config')).data,
    staleTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (campaign?.id) api.post(`/ads/${campaign.id}/impression`).catch(() => undefined);
  }, [campaign?.id]);

  const horizontal = placement === 'bottom';
  if (campaign) {
    return (
      <aside className={`ad-creative ${horizontal ? 'ad-creative-horizontal' : ''}`} aria-label="Advertisement">
        <span className="ad-disclosure">Advertisement</span>
        <a href={campaign.destinationUrl} target="_blank" rel="sponsored noopener noreferrer" onClick={() => api.post(`/ads/${campaign.id}/click`).catch(() => undefined)}>
          <img src={resolveApiAssetUrl(campaign.imageUrl)} alt="" className={horizontal ? 'h-36 w-full object-cover md:h-32 md:w-64' : 'aspect-[4/3] w-full object-cover'} />
          <span className="block p-4">
            <strong className="block font-serif text-xl font-medium leading-tight">{campaign.headline}</strong>
            <span className="mt-2 block text-xs leading-5 text-muted-foreground">{campaign.body}</span>
          </span>
        </a>
      </aside>
    );
  }

  if (config) {
    const contextual = <ContextualSlot placement={placement} config={config} />;
    if (config.enabled && config.slots[placement]) return <aside className="ad-creative p-3" aria-label="Advertisement"><span className="ad-disclosure">Advertisement</span>{contextual}</aside>;
  }

  return (
    <aside className={`ad-house ${horizontal ? 'md:flex-row md:items-center md:justify-between' : ''}`} aria-label="Advertising opportunity">
      <div><span className="ad-disclosure">Partner with Buyer Sync</span><p className="mt-3 font-serif text-xl">Reach active home buyers.</p></div>
      <Link to="/advertise" className="mt-4 inline-block text-xs font-semibold uppercase tracking-[0.15em] text-primary">Advertise here →</Link>
    </aside>
  );
};