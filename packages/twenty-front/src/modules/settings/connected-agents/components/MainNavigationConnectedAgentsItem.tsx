import { useQuery } from '@apollo/client/react';
import { useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { IconRobot } from 'twenty-ui/icon';
import { Pill } from 'twenty-ui/primitives/data-display';

import { useHasPermissionFlag } from '@/settings/roles/hooks/useHasPermissionFlag';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import {
  ConnectedAgentStatus,
  GetConnectedAgentsDocument,
  PermissionFlagType,
} from '~/generated-metadata/graphql';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';

const AGENT_SESSION_TTL_MS = 300000;

export const MainNavigationConnectedAgentsItem = () => {
  const { t } = useLingui();
  const navigateSettings = useNavigateSettings();
  const hasPermission = useHasPermissionFlag(
    PermissionFlagType.API_KEYS_AND_WEBHOOKS,
  );

  const { data } = useQuery(GetConnectedAgentsDocument, {
    pollInterval: 30000,
    skip: !hasPermission,
  });

  if (!hasPermission) {
    return null;
  }

  const connectedCount = (data?.connectedAgents ?? []).filter(
    (agent) =>
      agent.status === ConnectedAgentStatus.ACTIVE &&
      isDefined(agent.lastSeenAt) &&
      Date.now() - new Date(agent.lastSeenAt).getTime() < AGENT_SESSION_TTL_MS,
  ).length;

  return (
    <NavigationDrawerItem
      label={t`Connected Agents`}
      Icon={IconRobot}
      onClick={() => navigateSettings(SettingsPath.ConnectedAgents)}
      rightOptions={
        connectedCount > 0 ? <Pill label={String(connectedCount)} /> : undefined
      }
      alwaysShowRightOptions={connectedCount > 0}
    />
  );
};
