import { styled } from '@linaria/react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { ConnectedAgentActivityFeed } from '@/settings/connected-agents/components/ConnectedAgentActivityFeed';
import { connectedAgentTokenFamilyState } from '@/settings/connected-agents/states/connectedAgentTokenFamilyState';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsSkeletonLoader } from '@/settings/components/SettingsSkeletonLoader';
import { ApiKeyInput } from '@/settings/developers/components/ApiKeyInput';
import { useAtomFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans, useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import { H2Title, IconTrash } from 'twenty-ui/display';
import { Button, Toggle } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  ConnectedAgentStatus,
  DeleteConnectedAgentDocument,
  GetConnectedAgentDocument,
  SetConnectedAgentStatusDocument,
} from '~/generated-metadata/graphql';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';
import { beautifyPastDateRelativeToNowShort } from '~/utils/date-utils';

const StyledToggleRow = styled.div`
  align-items: center;
  display: flex;
  flex-direction: row;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledHelperText = styled.span`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.regular};
`;

const DELETE_CONNECTED_AGENT_MODAL_ID = 'delete-connected-agent-modal';

export const SettingsConnectedAgentDetail = () => {
  const { t } = useLingui();
  const { enqueueErrorSnackBar } = useSnackBar();
  const { openModal, closeModal } = useModal();
  const [isLoading, setIsLoading] = useState(false);

  const navigateSettings = useNavigateSettings();
  const { connectedAgentId = '' } = useParams();

  const connectedAgentToken = useAtomFamilyStateValue(
    connectedAgentTokenFamilyState,
    connectedAgentId,
  );

  const {
    data: connectedAgentData,
    loading: connectedAgentLoading,
    refetch,
  } = useQuery(GetConnectedAgentDocument, {
    variables: {
      input: {
        id: connectedAgentId,
      },
    },
  });

  const [setConnectedAgentStatus] = useMutation(SetConnectedAgentStatusDocument);
  const [deleteConnectedAgent] = useMutation(DeleteConnectedAgentDocument);

  const connectedAgent = connectedAgentData?.connectedAgent;

  const confirmationValue = t`yes`;

  const handleStatusToggle = async (nextIsActive: boolean) => {
    if (!isDefined(connectedAgent)) return;

    const nextStatus = nextIsActive
      ? ConnectedAgentStatus.ACTIVE
      : ConnectedAgentStatus.DISABLED;

    setIsLoading(true);
    try {
      await setConnectedAgentStatus({
        variables: {
          input: {
            id: connectedAgent.id,
            status: nextStatus,
          },
        },
      });
      await refetch();
    } catch {
      enqueueErrorSnackBar({
        message: t`Error updating agent status`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await deleteConnectedAgent({
        variables: {
          input: {
            id: connectedAgentId,
          },
        },
      });
      closeModal(DELETE_CONNECTED_AGENT_MODAL_ID);
      navigateSettings(SettingsPath.ConnectedAgents);
    } catch {
      enqueueErrorSnackBar({ message: t`Error deleting connected agent.` });
    } finally {
      setIsLoading(false);
    }
  };

  if (connectedAgentLoading) {
    return <SettingsSkeletonLoader />;
  }

  if (!isDefined(connectedAgent)) {
    return (
      <SubMenuTopBarContainer
        title={t`Agent not found`}
        links={[
          {
            children: t`Workspace`,
            href: getSettingsPath(SettingsPath.Workspace),
          },
          {
            children: t`Connected Agents`,
            href: getSettingsPath(SettingsPath.ConnectedAgents),
          },
          { children: t`Not found` },
        ]}
      >
        <SettingsPageContainer>
          <Section>
            <H2Title
              title={t`Agent not found`}
              description={t`This connected agent may have been deleted.`}
            />
          </Section>
        </SettingsPageContainer>
      </SubMenuTopBarContainer>
    );
  }

  const isActive = connectedAgent.status === ConnectedAgentStatus.ACTIVE;

  return (
    <>
      <SubMenuTopBarContainer
        title={connectedAgent.name || t`Unnamed agent`}
        links={[
          {
            children: t`Workspace`,
            href: getSettingsPath(SettingsPath.Workspace),
          },
          {
            children: t`Connected Agents`,
            href: getSettingsPath(SettingsPath.ConnectedAgents),
          },
          { children: connectedAgent.name || t`Unnamed agent` },
        ]}
      >
        <SettingsPageContainer>
          {isDefined(connectedAgentToken) && (
            <Section>
              <H2Title
                title={t`Token`}
                description={t`Copy this token, it won't be shown again`}
              />
              <ApiKeyInput apiKey={connectedAgentToken} />
            </Section>
          )}
          <Section>
            <H2Title title={t`Name`} description={t`Name of your agent`} />
            <SettingsTextInput
              instanceId={`connected-agent-name-${connectedAgent.id}`}
              value={connectedAgent.name || t`Unnamed agent`}
              disabled
              fullWidth
            />
          </Section>
          <Section>
            <H2Title
              title={t`Role`}
              description={t`What this agent can do`}
            />
            <SettingsTextInput
              instanceId={`connected-agent-role-${connectedAgent.id}`}
              value={connectedAgent.role?.label ?? t`No role assigned`}
              disabled
              fullWidth
            />
          </Section>
          <Section>
            <H2Title title={t`Last seen`} description={t`Last activity from this agent`} />
            <SettingsTextInput
              instanceId={`connected-agent-last-seen-${connectedAgent.id}`}
              value={
                connectedAgent.lastSeenAt
                  ? beautifyPastDateRelativeToNowShort(
                      new Date(connectedAgent.lastSeenAt),
                    )
                  : t`Never`
              }
              disabled
              fullWidth
            />
          </Section>
          <Section>
            <H2Title
              title={t`Status`}
              description={t`Enable or disable this agent`}
            />
            <StyledToggleRow>
              <Toggle
                value={isActive}
                onChange={handleStatusToggle}
                disabled={isLoading}
              />
              <StyledHelperText>
                {isActive
                  ? t`Active — this agent can write to your workspace.`
                  : t`Disabled — this agent is blocked from writing to your workspace. You can re-enable it at any time.`}
              </StyledHelperText>
            </StyledToggleRow>
          </Section>
          <Section>
            <H2Title
              title={t`Danger zone`}
              description={t`Delete this connected agent`}
            />
            <Button
              accent="danger"
              variant="secondary"
              title={t`Delete`}
              Icon={IconTrash}
              onClick={() => openModal(DELETE_CONNECTED_AGENT_MODAL_ID)}
            />
          </Section>
          <Section>
            <H2Title
              title={t`Activity`}
              description={t`Recent activity reported by this agent`}
            />
            <ConnectedAgentActivityFeed connectedAgentId={connectedAgentId} />
          </Section>
        </SettingsPageContainer>
      </SubMenuTopBarContainer>
      <ConfirmationModal
        confirmationPlaceholder={confirmationValue}
        confirmationValue={confirmationValue}
        modalInstanceId={DELETE_CONNECTED_AGENT_MODAL_ID}
        title={t`Delete connected agent`}
        subtitle={
          <Trans>
            Please type {`"${confirmationValue}"`} to confirm you want to
            delete this connected agent. This will revoke the agent's API key
            and permanently remove its access to your workspace.
          </Trans>
        }
        onConfirmClick={handleDelete}
        confirmButtonText={t`Delete`}
        loading={isLoading}
      />
    </>
  );
};
