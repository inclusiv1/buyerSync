type InvitationRequest = {
  get(name: string): string | undefined;
  protocol: string;
};

const firstHeaderValue = (value?: string) => value?.split(',')[0]?.trim();

const validOrigin = (value?: string) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') ? url.origin : null;
  } catch {
    return null;
  }
};

export const getInvitationBaseUrl = (req: InvitationRequest) => {
  const requestOrigin = validOrigin(req.get('origin'));
  if (requestOrigin) return requestOrigin;

  const host = firstHeaderValue(req.get('x-forwarded-host')) || req.get('host');
  const protocol = firstHeaderValue(req.get('x-forwarded-proto')) || req.protocol;
  const forwardedOrigin = validOrigin(host ? `${protocol}://${host}` : undefined);
  if (forwardedOrigin) return forwardedOrigin;

  const configuredOrigin = validOrigin(process.env.PUBLIC_APP_URL);
  if (configuredOrigin) return configuredOrigin;

  return 'http://localhost:5173';
};