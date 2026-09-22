import { type I18n } from '@lingui/core';
import { Column, Container, Row } from 'react-email';

import { Link } from 'src/components/Link';
import { ShadowText } from 'src/components/ShadowText';
import { BRAND_EMAIL_IDENTITY } from 'src/constants/BrandEmailIdentity';

const footerContainerStyle = {
  marginTop: '12px',
};

type FooterProps = {
  i18n: I18n;
};

export const Footer = ({ i18n }: FooterProps) => {
  return (
    <Container style={footerContainerStyle}>
      <Row>
        <Column>
          <ShadowText>
            <Link
              href={BRAND_EMAIL_IDENTITY.websiteUrl}
              value={i18n._('Website')}
              aria-label={i18n._('Visit the colaborato.rio website')}
            />
          </ShadowText>
        </Column>
        <Column>
          <ShadowText>
            <Link
              href={BRAND_EMAIL_IDENTITY.sourceCodeUrl}
              value={i18n._('Source code')}
              aria-label={i18n._('View the source code of this CRM')}
            />
          </ShadowText>
        </Column>
      </Row>
      <ShadowText>
        <>
          {BRAND_EMAIL_IDENTITY.name}
          <br />
          {/* AGPLv3 §13: network users must be offered the source. */}
          {i18n._('Built on Twenty (open source)')}
        </>
      </ShadowText>
    </Container>
  );
};
