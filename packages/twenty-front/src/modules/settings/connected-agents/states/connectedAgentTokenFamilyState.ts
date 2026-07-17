import { createAtomFamilyState } from '@/ui/utilities/state/jotai/utils/createAtomFamilyState';

export const connectedAgentTokenFamilyState = createAtomFamilyState<
  string | null,
  string
>({
  key: 'connectedAgentTokenState',
  defaultValue: null,
});
