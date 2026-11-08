import { type I18n } from '@lingui/core';
import { MainText } from 'src/components/MainText';
import { SubTitle } from 'src/components/SubTitle';
import { BRAND_EMAIL_IDENTITY } from 'src/constants/BrandEmailIdentity';

type WhatIsTwentyProps = {
  i18n: I18n;
};

export const WhatIsTwenty = ({ i18n }: WhatIsTwentyProps) => {
  const brandName = BRAND_EMAIL_IDENTITY.name;

  return (
    <>
      <SubTitle value={i18n._('What is {brandName}?', { brandName })} />
      <MainText>
        {i18n._(
          "It's the {brandName} CRM, where your team manages customers, deals and the AI agents that work with them.",
          { brandName },
        )}
      </MainText>
    </>
  );
};
