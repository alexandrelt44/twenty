import { useLingui } from '@lingui/react/macro';

import { Status } from 'twenty-ui/display';

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
    return <Status color="gray" text={t`Disabled`} />;
  }

  const isSessionActive =
    !!lastSeenAt &&
    Date.now() - new Date(lastSeenAt).getTime() < AGENT_SESSION_TTL_MS;

  if (isSessionActive) {
    return <Status color="green" text={t`Connected`} />;
  }

  return <Status color="orange" text={t`Idle`} />;
};
