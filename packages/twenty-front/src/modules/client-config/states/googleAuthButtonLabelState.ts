import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const googleAuthButtonLabelState = createAtomState<string | null>({
  key: 'googleAuthButtonLabelState',
  defaultValue: null,
});
