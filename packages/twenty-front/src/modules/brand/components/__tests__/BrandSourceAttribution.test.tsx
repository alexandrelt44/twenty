import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';

import { BrandSourceAttribution } from '@/brand/components/BrandSourceAttribution';

describe('BrandSourceAttribution', () => {
  it('should credit Twenty and link to the fork source code', () => {
    render(
      <I18nProvider i18n={i18n}>
        <BrandSourceAttribution />
      </I18nProvider>,
    );

    expect(screen.getByText('Built on Twenty (open source)')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Source code' })).toHaveAttribute(
      'href',
      'https://github.com/alexandrelt44/twenty',
    );
  });
});
