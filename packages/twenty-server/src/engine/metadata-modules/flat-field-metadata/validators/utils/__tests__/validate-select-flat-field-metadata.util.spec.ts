import { FieldMetadataType } from 'twenty-shared/types';

import { type FlatFieldMetadataValidationError } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata-validation-error.type';
import { validateSelectFlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/validators/utils/validate-select-flat-field-metadata.util';
import { type UniversalFlatFieldMetadata } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-field-metadata.type';

const OPTION_ID_NEW = '11111111-1111-4111-8111-111111111111';
const OPTION_ID_CUSTOMER = '22222222-2222-4222-8222-222222222222';

const createFlatEntityToValidate = (
  overrides: Partial<UniversalFlatFieldMetadata<FieldMetadataType.SELECT>> = {},
): UniversalFlatFieldMetadata<FieldMetadataType.SELECT> =>
  ({
    type: FieldMetadataType.SELECT,
    name: 'stage',
    label: 'Stage',
    universalSettings: null,
    options: [
      { id: OPTION_ID_NEW, value: 'NEW', label: 'New', position: 0 },
      {
        id: OPTION_ID_CUSTOMER,
        value: 'CUSTOMER',
        label: 'Customer',
        position: 1,
      },
    ],
    ...overrides,
  }) as UniversalFlatFieldMetadata<FieldMetadataType.SELECT>;

const callValidator = (
  flatEntityToValidate: UniversalFlatFieldMetadata<FieldMetadataType.SELECT>,
) =>
  validateSelectFlatFieldMetadata({
    flatEntityToValidate,
  } as Parameters<typeof validateSelectFlatFieldMetadata>[0]);

const stripUserFriendlyMessage = (errors: FlatFieldMetadataValidationError[]) =>
  errors.map(({ userFriendlyMessage: _, ...rest }) => rest);

describe('validateSelectFlatFieldMetadata', () => {
  it('should accept null settings', () => {
    expect(callValidator(createFlatEntityToValidate())).toEqual([]);
  });

  it('should accept settings without stageKinds', () => {
    const errors = callValidator(
      createFlatEntityToValidate({ universalSettings: {} }),
    );

    expect(errors).toEqual([]);
  });

  it('should accept valid stageKinds', () => {
    const errors = callValidator(
      createFlatEntityToValidate({
        universalSettings: {
          stageKinds: { [OPTION_ID_NEW]: 'OPEN', [OPTION_ID_CUSTOMER]: 'WON' },
        },
      }),
    );

    expect(errors).toEqual([]);
  });

  it('should reject a stage kind outside OPEN, WON and LOST', () => {
    const errors = callValidator(
      createFlatEntityToValidate({
        universalSettings: { stageKinds: { [OPTION_ID_NEW]: 'DONE' } },
      } as never),
    );

    expect(stripUserFriendlyMessage(errors)).toEqual([
      {
        code: 'INVALID_FIELD_INPUT',
        message: `stageKinds value for option "${OPTION_ID_NEW}" must be one of OPEN, WON, LOST`,
        value: 'DONE',
      },
    ]);
  });

  it('should reject a key that is not an option id', () => {
    const errors = callValidator(
      createFlatEntityToValidate({
        universalSettings: {
          stageKinds: { '33333333-3333-4333-8333-333333333333': 'LOST' },
        },
      }),
    );

    expect(stripUserFriendlyMessage(errors)).toEqual([
      {
        code: 'INVALID_FIELD_INPUT',
        message:
          'stageKinds key "33333333-3333-4333-8333-333333333333" is not the id of an option of this field',
        value: '33333333-3333-4333-8333-333333333333',
      },
    ]);
  });

  it('should reject stageKinds that is not an object', () => {
    const errors = callValidator(
      createFlatEntityToValidate({
        universalSettings: { stageKinds: 'WON' },
      } as never),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('INVALID_FIELD_INPUT');
  });
});
