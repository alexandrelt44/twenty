import {
  pruneStageKindsOfRemovedOptions,
  setStageKindInSettings,
} from '@/settings/data-model/fields/forms/select/utils/updateSelectStageKinds';

describe('setStageKindInSettings', () => {
  it('creates stageKinds from null settings', () => {
    expect(
      setStageKindInSettings({
        settings: null,
        optionId: 'a',
        stageKind: 'WON',
      }),
    ).toEqual({ stageKinds: { a: 'WON' } });
  });

  it('keeps existing entries and other settings keys', () => {
    const settings = { stageKinds: { a: 'WON' as const }, other: 1 };

    expect(
      setStageKindInSettings({ settings, optionId: 'b', stageKind: 'LOST' }),
    ).toEqual({ stageKinds: { a: 'WON', b: 'LOST' }, other: 1 });
  });

  it('overrides the kind of an option', () => {
    expect(
      setStageKindInSettings({
        settings: { stageKinds: { a: 'WON' } },
        optionId: 'a',
        stageKind: 'OPEN',
      }),
    ).toEqual({ stageKinds: { a: 'OPEN' } });
  });
});

describe('pruneStageKindsOfRemovedOptions', () => {
  it('drops keys of options that no longer exist', () => {
    expect(
      pruneStageKindsOfRemovedOptions({
        settings: { stageKinds: { a: 'WON', b: 'LOST' } },
        remainingOptionIds: ['b'],
      }),
    ).toEqual({ stageKinds: { b: 'LOST' } });
  });

  it('returns settings untouched when there is no stageKinds', () => {
    expect(
      pruneStageKindsOfRemovedOptions({
        settings: null,
        remainingOptionIds: [],
      }),
    ).toBeNull();
  });
});
