import { ConnectedAgentsTable } from '@/settings/connected-agents/components/ConnectedAgentsTable';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans, useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { H2Title, IconPlus } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';

export const SettingsConnectedAgents = () => {
  const { t } = useLingui();

  return (
    <SubMenuTopBarContainer
      title={t`Connected Agents`}
      actionButton={
        <Button
          Icon={IconPlus}
          title={t`New agent`}
          accent="blue"
          size="small"
          to={getSettingsPath(SettingsPath.NewConnectedAgent)}
        />
      }
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        { children: <Trans>Connected Agents</Trans> },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title={t`Connected Agents`}
            description={t`Agents connected to your workspace via the API.`}
          />
          <ConnectedAgentsTable />
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
