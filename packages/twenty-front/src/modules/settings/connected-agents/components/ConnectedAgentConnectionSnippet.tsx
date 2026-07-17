import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { isDefined } from 'twenty-shared/utils';
import { IconCopy } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledCodeBlock = styled.pre`
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-family: ${themeCssVariables.code.font.family}, monospace;
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
  overflow-x: auto;
  padding: ${themeCssVariables.spacing[3]};
  white-space: pre;
`;

const StyledButtonRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
`;

type ConnectedAgentConnectionSnippetProps = {
  agentName: string;
  roleLabel?: string | null;
  token?: string | null;
};

export const ConnectedAgentConnectionSnippet = ({
  agentName,
  roleLabel,
  token,
}: ConnectedAgentConnectionSnippetProps) => {
  const { t } = useLingui();
  const { copyToClipboard } = useCopyToClipboard();

  const base = REACT_APP_SERVER_BASE_URL;
  const name = agentName;
  const role = roleLabel ?? 'the role assigned to your API key';
  const bearer = token ?? '$AGENT_TOKEN';

  const tokenNote = isDefined(token)
    ? ''
    : `Note: the real token was only shown once, at creation time. Replace $AGENT_TOKEN below with it.\n\n`;

  const prompt = `${tokenNote}You are a Connected Agent named "${name}" operating inside a Twenty CRM workspace (role: ${role}).
Authenticate every request with the header:  Authorization: Bearer ${bearer}
Base URL: ${base}

# 1. Open a session (required before writing)
Your writes are BLOCKED until you have an active bridge session.
  POST ${base}/agent-bridge/connect      -> returns your identity + role
Keep the session alive by sending a heartbeat every ~2 minutes:
  POST ${base}/agent-bridge/heartbeat
If a write ever returns 403 "connect to the bridge", reconnect and heartbeat.

# 2. Read and write CRM records
Use the Twenty REST API with your Bearer token. Everything you create or update is
attributed to you (createdBy/updatedBy = AGENT) and appears in the workspace history.
  GET   ${base}/rest/companies                 # read
  POST  ${base}/rest/companies  {"name":"Acme Inc"}     # create
  PATCH ${base}/rest/companies/:id  {"name":"Acme"}     # update
API reference: ${base}/rest (REST) or ${base}/graphql (GraphQL). Stay within your role's permissions (${role}).

# 3. Report what you are doing
Post short activity events — they show in this agent's Activity feed for the operator:
  POST ${base}/agent-bridge/events  {"type":"ACTION","summary":"Created a company","payload":{}}
  (type is one of PROMPT, ACTION, NOTE)

# Notes
- The operator can disable you (writes blocked, reversible) or delete you (token revoked) at any time.
- Never expose or log this token; it grants your role's access to the workspace.`;

  return (
    <StyledContainer>
      <StyledCodeBlock>{prompt}</StyledCodeBlock>
      <StyledButtonRow>
        <Button
          Icon={IconCopy}
          title={t`Copy prompt`}
          onClick={() => {
            copyToClipboard(prompt, t`Agent prompt copied to clipboard`);
          }}
        />
      </StyledButtonRow>
    </StyledContainer>
  );
};
