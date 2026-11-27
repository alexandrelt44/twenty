import {
  type FieldMetadataSelectSettings,
  type SelectStageKind,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

type SelectSettings = FieldMetadataSelectSettings | null | undefined;

// The server replaces settings as a whole, so every helper keeps the other keys
export const setStageKindInSettings = ({
  settings,
  optionId,
  stageKind,
}: {
  settings: SelectSettings;
  optionId: string;
  stageKind: SelectStageKind;
}): FieldMetadataSelectSettings => ({
  ...settings,
  stageKinds: { ...settings?.stageKinds, [optionId]: stageKind },
});

export const pruneStageKindsOfRemovedOptions = ({
  settings,
  remainingOptionIds,
}: {
  settings: SelectSettings;
  remainingOptionIds: string[];
}): SelectSettings => {
  if (!isDefined(settings?.stageKinds)) {
    return settings;
  }

  const remainingStageKinds = Object.fromEntries(
    Object.entries(settings.stageKinds).filter(([optionId]) =>
      remainingOptionIds.includes(optionId),
    ),
  );

  return { ...settings, stageKinds: remainingStageKinds };
};
