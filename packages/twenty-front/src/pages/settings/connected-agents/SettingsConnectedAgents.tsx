import { ConnectedAgentsTable } from '@/settings/connected-agents/components/ConnectedAgentsTable';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { NavigationButton } from '@/ui/input/components/NavigationButton';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { Trans, useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { IconPlus } from 'twenty-ui/icon';
import { Section } from 'twenty-ui/primitives/layout';
import { H2Title } from 'twenty-ui/primitives/typography';

export const SettingsConnectedAgents = () => {
  const { t } = useLingui();

  return (
    <SettingsPageLayout
      title={t`Connected Agents`}
      actionButton={
        <NavigationButton
          startIcon={<IconPlus />}
          size="sm"
          color="accent"
          to={getSettingsPath(SettingsPath.NewConnectedAgent)}
        >{t`New agent`}</NavigationButton>
      }
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.General),
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
    </SettingsPageLayout>
  );
};
