import { Font, Head } from 'react-email';

import { canvasTheme } from 'src/common-style';
import { BRAND_EMAIL_IDENTITY } from 'src/constants/BrandEmailIdentity';

export const BaseHead = () => {
  return (
    <Head>
      <title>{BRAND_EMAIL_IDENTITY.name}</title>
      <Font
        fontFamily={canvasTheme.font.family}
        fallbackFontFamily="sans-serif"
        fontStyle="normal"
        fontWeight={canvasTheme.font.weight.regular}
      />
    </Head>
  );
};
