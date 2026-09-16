import { useLingui } from '@lingui/react/macro';

import { Status } from 'twenty-ui/primitives/data-display';

const AGENT_SESSION_TTL_MS = 300000;

type ConnectedAgentStatusCellProps = {
  status: string;
  lastSeenAt?: string | null;
};

export const ConnectedAgentStatusCell = ({
  status,
  lastSeenAt,
}: ConnectedAgentStatusCellProps) => {
  const { t } = useLingui();

  if (status === 'DISABLED') {
    return <Status color="gray">{t`Disabled`}</Status>;
  }

  const isSessionActive =
    !!lastSeenAt &&
    Date.now() - new Date(lastSeenAt).getTime() < AGENT_SESSION_TTL_MS;

  if (isSessionActive) {
    return <Status color="green">{t`Connected`}</Status>;
  }

  return <Status color="orange">{t`Idle`}</Status>;
};
