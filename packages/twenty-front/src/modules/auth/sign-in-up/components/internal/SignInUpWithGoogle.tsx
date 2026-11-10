import { isDefined } from 'twenty-shared/utils';
import { useHasMultipleAuthMethods } from '@/auth/sign-in-up/hooks/useHasMultipleAuthMethods';
import { useSignInWithGoogle } from '@/auth/sign-in-up/hooks/useSignInWithGoogle';
import { lastAuthenticatedMethodState } from '@/auth/states/lastAuthenticatedMethodState';
import {
  SignInUpStep,
  signInUpStepState,
} from '@/auth/states/signInUpStepState';
import { AuthenticatedMethod } from '@/auth/types/AuthenticatedMethod.enum';
import { type SocialSsoSignInUpActionType } from '@/auth/types/socialSsoSignInUp.type';
import { googleAuthButtonLabelState } from '@/client-config/states/googleAuthButtonLabelState';
import { useLingui } from '@lingui/react/macro';
import { memo, useContext } from 'react';
import { MainButton } from 'twenty-ui/components';
import { IconGoogle } from 'twenty-ui/icon';
import { HorizontalSeparator } from 'twenty-ui/primitives/layout';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { LastUsedPill } from './LastUsedPill';
import { StyledSsoButtonContainer } from './SignInUpSsoButtonStyles';
import { ThemeContext } from 'twenty-ui/theme-constants';

const GoogleIcon = memo(() => {
  const { theme } = useContext(ThemeContext);
  return <IconGoogle size={theme.icon.size.md} />;
});

export const SignInUpWithGoogle = ({
  action,
  isGlobalScope,
}: {
  action: SocialSsoSignInUpActionType;
  isGlobalScope?: boolean;
}) => {
  const { t } = useLingui();
  const signInUpStep = useAtomStateValue(signInUpStepState);
  const googleAuthButtonLabel = useAtomStateValue(googleAuthButtonLabelState);
  const [lastAuthenticatedMethod, setLastAuthenticatedMethod] = useAtomState(
    lastAuthenticatedMethodState,
  );
  const { signInWithGoogle } = useSignInWithGoogle();
  const hasMultipleAuthMethods = useHasMultipleAuthMethods();

  const handleClick = () => {
    setLastAuthenticatedMethod(AuthenticatedMethod.GOOGLE);
    signInWithGoogle({ action });
  };

  const isLastUsed = lastAuthenticatedMethod === AuthenticatedMethod.GOOGLE;

  // A custom label means sign-in goes to another provider, so the Google logo would mislead
  const hasCustomLabel = isDefined(googleAuthButtonLabel);

  return (
    <>
      <StyledSsoButtonContainer>
        <MainButton
          startIcon={hasCustomLabel ? undefined : <GoogleIcon />}
          onClick={handleClick}
          fullWidth
          variant={signInUpStep === SignInUpStep.Init ? 'solid' : 'outline'}
        >
          {hasCustomLabel ? googleAuthButtonLabel : t`Continue with Google`}
        </MainButton>
        {isLastUsed && (isGlobalScope || hasMultipleAuthMethods) && (
          <LastUsedPill />
        )}
      </StyledSsoButtonContainer>
      <HorizontalSeparator visible={false} />
    </>
  );
};
