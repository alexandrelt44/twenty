import { styled } from '@linaria/react';
import { Trans } from '@lingui/react/macro';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { BRAND_IDENTITY } from '@/brand/constants/BrandIdentity';

// AGPLv3 §13: users interacting over a network must be offered the source.
const StyledAttribution = styled.div`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[1]};

  a {
    color: inherit;
  }
`;

export const BrandSourceAttribution = () => {
  return (
    <StyledAttribution>
      <Trans>Built on Twenty (open source)</Trans> ·{' '}
      <a
        href={BRAND_IDENTITY.sourceCodeUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Trans>Source code</Trans>
      </a>
    </StyledAttribution>
  );
};
