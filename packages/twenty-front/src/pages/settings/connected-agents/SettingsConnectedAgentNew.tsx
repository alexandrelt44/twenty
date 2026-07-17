import { addDays } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';

import { SaveAndCancelButtons } from '@/settings/components/SaveAndCancelButtons/SaveAndCancelButtons';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsSkeletonLoader } from '@/settings/components/SettingsSkeletonLoader';
import { connectedAgentTokenFamilyState } from '@/settings/connected-agents/states/connectedAgentTokenFamilyState';
import { SettingsDevelopersRoleSelector } from '@/settings/developers/components/SettingsDevelopersRoleSelector';
import { EXPIRATION_DATES } from '@/settings/developers/constants/ExpirationDates';
import { Select } from '@/ui/input/components/Select';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { useMutation, useQuery } from '@apollo/client/react';
import { useLingui } from '@lingui/react/macro';
import { useStore } from 'jotai';
import { Key } from 'ts-key-enum';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import { H2Title } from 'twenty-ui/display';
import { Section } from 'twenty-ui/layout';
import {
  CreateConnectedAgentDocument,
  GetRolesDocument,
} from '~/generated-metadata/graphql';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';

export const SettingsConnectedAgentNew = () => {
  const { t } = useLingui();
  const navigateSettings = useNavigateSettings();
  const { data: rolesData, loading: rolesLoading } = useQuery(GetRolesDocument);
  const roles = rolesData?.getRoles ?? [];

  const [formValues, setFormValues] = useState<{
    name: string;
    expirationDate: number | null;
    roleId: string;
  }>({
    expirationDate: EXPIRATION_DATES[5].value,
    name: '',
    roleId: '',
  });

  useEffect(() => {
    if (isDefined(rolesData?.getRoles)) {
      const connectedAgentAssignableRoles = rolesData.getRoles.filter(
        (role) => role.canBeAssignedToApiKeys,
      );
      if (connectedAgentAssignableRoles.length > 0) {
        setFormValues((prev) => {
          if (!prev.roleId) {
            return { ...prev, roleId: connectedAgentAssignableRoles[0].id };
          }
          return prev;
        });
      }
    }
  }, [rolesData]);

  const [createConnectedAgent] = useMutation(CreateConnectedAgentDocument);

  const jotaiStore = useStore();

  const setConnectedAgentTokenCallback = useCallback(
    (connectedAgentId: string, token: string) => {
      jotaiStore.set(
        connectedAgentTokenFamilyState.atomFamily(connectedAgentId),
        token,
      );
    },
    [jotaiStore],
  );

  const handleSave = async () => {
    if (!formValues.name) return;

    const roleIdToUse = formValues.roleId;

    if (!roleIdToUse) {
      return;
    }

    const expiresAt = addDays(
      new Date(),
      formValues.expirationDate ?? 30,
    ).toISOString();

    const { data: newConnectedAgentData } = await createConnectedAgent({
      variables: {
        input: {
          name: formValues.name.trim(),
          expiresAt,
          roleId: roleIdToUse,
        },
      },
    });

    const newConnectedAgent = newConnectedAgentData?.createConnectedAgent;

    if (!newConnectedAgent) {
      return;
    }

    setConnectedAgentTokenCallback(
      newConnectedAgent.connectedAgent.id,
      newConnectedAgent.token,
    );

    navigateSettings(SettingsPath.ConnectedAgentDetail, {
      connectedAgentId: newConnectedAgent.connectedAgent.id,
    });
  };

  const canSave = !!formValues.name && !!formValues.roleId;

  if (rolesLoading) {
    return <SettingsSkeletonLoader />;
  }

  return (
    <SubMenuTopBarContainer
      title={t`New agent`}
      links={[
        {
          children: t`Workspace`,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        {
          children: t`Connected Agents`,
          href: getSettingsPath(SettingsPath.ConnectedAgents),
        },
        { children: t`New agent` },
      ]}
      actionButton={
        <SaveAndCancelButtons
          isSaveDisabled={!canSave}
          onCancel={() => {
            navigateSettings(SettingsPath.ConnectedAgents);
          }}
          onSave={handleSave}
        />
      }
    >
      <SettingsPageContainer>
        <Section>
          <H2Title title={t`Name`} description={t`Name of your agent`} />
          <SettingsTextInput
            instanceId="connected-agent-new-name"
            placeholder={t`E.g. backoffice integration`}
            value={formValues.name}
            onKeyDown={(e) => {
              if (e.key === Key.Enter) {
                handleSave();
              }
            }}
            onChange={(value) => {
              setFormValues((prevState) => ({
                ...prevState,
                name: value,
              }));
            }}
            fullWidth
          />
        </Section>
        <Section>
          <H2Title
            title={t`Role`}
            description={t`What this agent can do: Select a user role to define its permissions.`}
          />
          <SettingsDevelopersRoleSelector
            value={formValues.roleId}
            onChange={(roleId) => {
              setFormValues((prevState) => ({
                ...prevState,
                roleId,
              }));
            }}
            roles={roles}
          />
        </Section>
        <Section>
          <H2Title
            title={t`Expiration Date`}
            description={t`When the agent's token will expire.`}
          />
          <Select
            dropdownId="connected-agent-expiration-date-select"
            options={EXPIRATION_DATES}
            value={formValues.expirationDate}
            onChange={(value) => {
              setFormValues((prevState) => ({
                ...prevState,
                expirationDate: value,
              }));
            }}
          />
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
