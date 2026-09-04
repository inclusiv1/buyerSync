type BrandLogoProps = {
  className?: string;
  variant?: 'default' | 'on-dark';
};

const BrandLogo = ({ className = '', variant = 'default' }: BrandLogoProps) => (
  <img
    src={variant === 'on-dark' ? '/home-buyer-sync-logo-dark.png' : '/home-buyer-sync-logo.png'}
    alt="Home Buyer Sync — Syncing You to Your Dream Home"
    className={className}
  />
);

export default BrandLogo;