import { type I18n } from '@lingui/core';
import { MainText } from 'src/components/MainText';
import { SubTitle } from 'src/components/SubTitle';

type WhatIsTwentyProps = {
  i18n: I18n;
};

export const WhatIsTwenty = ({ i18n }: WhatIsTwentyProps) => {
  return (
    <>
      <SubTitle value={i18n._('What is colaborato.rio?')} />
      <MainText>
        {i18n._(
          "It's the colaborato.rio CRM, where your team manages customers, deals and the AI agents that work with them.",
        )}
      </MainText>
    </>
  );
};
