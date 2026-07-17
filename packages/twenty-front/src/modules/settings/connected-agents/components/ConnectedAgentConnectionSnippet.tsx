import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
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
  token?: string | null;
};

export const ConnectedAgentConnectionSnippet = ({
  token,
}: ConnectedAgentConnectionSnippetProps) => {
  const { t } = useLingui();
  const { copyToClipboard } = useCopyToClipboard();

  const bearer = token ?? '$AGENT_TOKEN';
  const base = REACT_APP_SERVER_BASE_URL;

  const snippet = `# 1) Connect — opens the agent's session (required before it can write)
curl -X POST ${base}/agent-bridge/connect \\
  -H "Authorization: Bearer ${bearer}"

# 2) Heartbeat every ~2 min to keep the session alive
curl -X POST ${base}/agent-bridge/heartbeat \\
  -H "Authorization: Bearer ${bearer}"

# 3) Write to the CRM — attributed to this agent (e.g. create a company)
curl -X POST ${base}/rest/companies \\
  -H "Authorization: Bearer ${bearer}" -H "Content-Type: application/json" \\
  -d '{"name":"Acme Inc"}'

# 4) Report activity — shows in this agent's feed
curl -X POST ${base}/agent-bridge/events \\
  -H "Authorization: Bearer ${bearer}" -H "Content-Type: application/json" \\
  -d '{"type":"ACTION","summary":"Created a company"}'`;

  return (
    <StyledContainer>
      <StyledCodeBlock>{snippet}</StyledCodeBlock>
      <StyledButtonRow>
        <Button
          Icon={IconCopy}
          title={t`Copy`}
          onClick={() => {
            copyToClipboard(snippet, t`Connection snippet copied to clipboard`);
          }}
        />
      </StyledButtonRow>
    </StyledContainer>
  );
};
