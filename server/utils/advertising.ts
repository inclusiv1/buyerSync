export const adPlacements = ['left', 'right', 'bottom', 'any'] as const;
export const adStatuses = ['draft', 'pending', 'approved', 'rejected', 'paused'] as const;
export const paymentStatuses = ['pending', 'invoiced', 'paid', 'waived'] as const;

const text = (value: unknown, label: string, maxLength: number) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`${label} must be between 1 and ${maxLength} characters`);
  }
  return value.trim();
};

export const safeHttpsUrl = (value: unknown, label: string) => {
  const raw = text(value, label, 2048);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${label} must be a public HTTPS URL without credentials`);
  }
  return url.toString();
};

const safeCreativeUrl = (value: unknown) => {
  if (typeof value === 'string' && /^\/api\/uploads\/ad-creatives\/[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(value)) {
    return value;
  }
  return safeHttpsUrl(value, 'Image URL');
};

const optionalDate = (value: unknown, label: string) => {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date`);
  return date;
};

export const parseCampaign = (body: Record<string, unknown>) => {
  const placement = typeof body.placement === 'string' ? body.placement : 'any';
  if (!adPlacements.includes(placement as typeof adPlacements[number])) {
    throw new Error('Placement must be left, right, bottom, or any');
  }
  const startsAt = optionalDate(body.startsAt, 'Start date');
  const endsAt = optionalDate(body.endsAt, 'End date');
  if (startsAt && endsAt && endsAt <= startsAt) throw new Error('End date must be after start date');

  return {
    name: text(body.name, 'Campaign name', 80),
    headline: text(body.headline, 'Headline', 80),
    body: text(body.body, 'Ad copy', 240),
    imageUrl: safeCreativeUrl(body.imageUrl),
    destinationUrl: safeHttpsUrl(body.destinationUrl, 'Destination URL'),
    placement,
    startsAt,
    endsAt,
  };
};

export const isCampaignLive = (campaign: { status: string; paymentStatus: string; startsAt: Date | null; endsAt: Date | null }, now = new Date()) =>
  campaign.status === 'approved'
  && ['paid', 'waived'].includes(campaign.paymentStatus)
  && (!campaign.startsAt || campaign.startsAt <= now)
  && (!campaign.endsAt || campaign.endsAt > now);