import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';

import { FooterNote } from '@/auth/sign-in-up/components/FooterNote';
import { useWorkspaceBypass } from '@/auth/sign-in-up/hooks/useWorkspaceBypass';
import { useIsCurrentLocationOnAWorkspace } from '@/domain-manager/hooks/useIsCurrentLocationOnAWorkspace';

jest.mock('@/auth/sign-in-up/hooks/useWorkspaceBypass');
jest.mock('@/domain-manager/hooks/useIsCurrentLocationOnAWorkspace');

const renderFooterNote = (isOnAWorkspace: boolean) => {
  jest
    .mocked(useIsCurrentLocationOnAWorkspace)
    .mockReturnValue({ isOnAWorkspace });
  jest.mocked(useWorkspaceBypass).mockReturnValue({
    shouldOfferBypass: false,
    shouldUseBypass: false,
    enableBypass: jest.fn(),
  } as unknown as ReturnType<typeof useWorkspaceBypass>);

  return render(
    <I18nProvider i18n={i18n}>
      <FooterNote />
    </I18nProvider>,
  );
};

describe('FooterNote', () => {
  it.each([[true], [false]])(
    'links only to the company privacy policy when isOnAWorkspace is %s',
    (isOnAWorkspace) => {
      const { container } = renderFooterNote(isOnAWorkspace);

      const links = screen.getAllByRole('link');

      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute(
        'href',
        'https://colaborato.rio/privacidade',
      );
      expect(container).not.toHaveTextContent(/Twenty/);
      expect(container).not.toHaveTextContent(/Terms of Service/);
      expect(container).not.toHaveTextContent(/Data Processing Agreement/);
    },
  );
});
