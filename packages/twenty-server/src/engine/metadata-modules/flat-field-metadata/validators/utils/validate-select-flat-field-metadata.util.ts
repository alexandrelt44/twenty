import { msg } from '@lingui/core/macro';
import {
  SELECT_STAGE_KINDS,
  type FieldMetadataType,
} from 'twenty-shared/types';
import { isDefined, isPlainObject } from 'twenty-shared/utils';

import { FieldMetadataExceptionCode } from 'src/engine/metadata-modules/field-metadata/field-metadata.exception';
import { type FlatFieldMetadataTypeValidationArgs } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata-type-validator.type';
import { type FlatFieldMetadataValidationError } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata-validation-error.type';

export const validateSelectFlatFieldMetadata = ({
  flatEntityToValidate,
}: FlatFieldMetadataTypeValidationArgs<FieldMetadataType.SELECT>): FlatFieldMetadataValidationError[] => {
  const settings: unknown = flatEntityToValidate.universalSettings;

  if (!isDefined(settings)) {
    return [];
  }

  if (!isPlainObject(settings)) {
    return [
      {
        code: FieldMetadataExceptionCode.INVALID_FIELD_INPUT,
        message: 'Select field settings must be an object',
        userFriendlyMessage: msg`Select field settings must be an object`,
        value: settings,
      },
    ];
  }

  const { stageKinds } = settings as { stageKinds?: unknown };

  if (!isDefined(stageKinds)) {
    return [];
  }

  if (!isPlainObject(stageKinds)) {
    return [
      {
        code: FieldMetadataExceptionCode.INVALID_FIELD_INPUT,
        message: 'stageKinds must be an object keyed by option id',
        userFriendlyMessage: msg`stageKinds must be an object keyed by option id`,
        value: stageKinds,
      },
    ];
  }

  const errors: FlatFieldMetadataValidationError[] = [];
  const optionIds = new Set(
    (flatEntityToValidate.options ?? []).map((option) => option.id),
  );

  for (const [optionId, stageKind] of Object.entries(stageKinds)) {
    if (!optionIds.has(optionId)) {
      errors.push({
        code: FieldMetadataExceptionCode.INVALID_FIELD_INPUT,
        message: `stageKinds key "${optionId}" is not the id of an option of this field`,
        userFriendlyMessage: msg`stageKinds key "${optionId}" is not the id of an option of this field`,
        value: optionId,
      });
    }

    if (!SELECT_STAGE_KINDS.some((allowedKind) => allowedKind === stageKind)) {
      errors.push({
        code: FieldMetadataExceptionCode.INVALID_FIELD_INPUT,
        message: `stageKinds value for option "${optionId}" must be one of ${SELECT_STAGE_KINDS.join(', ')}`,
        userFriendlyMessage: msg`stageKinds value must be OPEN, WON or LOST`,
        value: stageKind,
      });
    }
  }

  return errors;
};
