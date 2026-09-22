import { Img } from 'react-email';

import { BRAND_EMAIL_IDENTITY } from 'src/constants/BrandEmailIdentity';

const logoStyle = {
  marginBottom: '40px',
};

export const Logo = () => {
  return (
    <Img
      src={BRAND_EMAIL_IDENTITY.logoUrl}
      alt={`${BRAND_EMAIL_IDENTITY.name} logo`}
      width="40"
      height="40"
      style={logoStyle}
    />
  );
};
