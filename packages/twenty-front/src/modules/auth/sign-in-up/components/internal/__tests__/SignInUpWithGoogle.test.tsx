import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { SOURCE_LOCALE } from 'twenty-shared/translations';
import { ThemeProvider } from 'twenty-ui/theme-constants';

import { SignInUpWithGoogle } from '@/auth/sign-in-up/components/internal/SignInUpWithGoogle';
import { googleAuthButtonLabelState } from '@/client-config/states/googleAuthButtonLabelState';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { dynamicActivate } from '~/utils/i18n/dynamicActivate';

const signInWithGoogleMock = jest.fn();

jest.mock('@/auth/sign-in-up/hooks/useSignInWithGoogle', () => ({
  useSignInWithGoogle: () => ({ signInWithGoogle: signInWithGoogleMock }),
}));

jest.mock('@/auth/sign-in-up/hooks/useHasMultipleAuthMethods', () => ({
  useHasMultipleAuthMethods: () => false,
}));

dynamicActivate(SOURCE_LOCALE);

const renderButton = () =>
  render(
    <JotaiProvider store={jotaiStore}>
      <ThemeProvider colorScheme="light">
        <I18nProvider i18n={i18n}>
          <SignInUpWithGoogle action="list-available-workspaces" />
        </I18nProvider>
      </ThemeProvider>
    </JotaiProvider>,
  );

describe('SignInUpWithGoogle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetJotaiStore();
  });

  it('offers Google sign-in by default', () => {
    renderButton();

    expect(
      screen.getByRole('button', { name: 'Continue with Google' }),
    ).toBeInTheDocument();
  });

  it('shows the configured label when sign-in goes to another provider', () => {
    jotaiStore.set(googleAuthButtonLabelState.atom, 'Entrar com Colaboratório');

    renderButton();

    expect(
      screen.queryByRole('button', { name: 'Continue with Google' }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Entrar com Colaboratório' }),
    );

    expect(signInWithGoogleMock).toHaveBeenCalledWith({
      action: 'list-available-workspaces',
    });
  });
});
