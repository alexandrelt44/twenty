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
  if (status === 'DISABLED') {
    return <Status color="gray" text="Disabled" />;
  }

  const isSessionActive =
    !!lastSeenAt &&
    Date.now() - new Date(lastSeenAt).getTime() < AGENT_SESSION_TTL_MS;

  if (isSessionActive) {
    return <Status color="green" text="Connected" />;
  }

  return <Status color="orange" text="Idle" />;
};
