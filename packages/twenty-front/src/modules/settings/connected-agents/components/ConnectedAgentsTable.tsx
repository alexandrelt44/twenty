import { ConnectedAgentStatusCell } from '@/settings/connected-agents/components/ConnectedAgentStatusCell';
import { SettingsEmptyPlaceholder } from '@/settings/components/SettingsEmptyPlaceholder';
import { Table } from '@/ui/layout/table/components/Table';
import { TableBody } from '@/ui/layout/table/components/TableBody';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useContext } from 'react';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { IconChevronRight } from 'twenty-ui/icon';
import { ThemeContext, themeCssVariables } from 'twenty-ui/theme-constants';
import { useQuery } from '@apollo/client/react';
import { GetConnectedAgentsDocument } from '~/generated-metadata/graphql';
import { beautifyPastDateRelativeToNowShort } from '~/utils/date-utils';

const StyledTableBodyContainer = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
`;

const StyledEllipsisLabel = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const GRID_AUTO_COLUMNS = '3fr 2fr 2fr 2fr 1fr';

export const ConnectedAgentsTable = () => {
  const { t } = useLingui();
  const { theme } = useContext(ThemeContext);
  const { data, loading } = useQuery(GetConnectedAgentsDocument);

  const connectedAgents = data?.connectedAgents;

  if (loading && !connectedAgents) {
    return (
      <SettingsEmptyPlaceholder>
        <Trans>Loading connected agents...</Trans>
      </SettingsEmptyPlaceholder>
    );
  }

  if (!connectedAgents?.length) {
    return (
      <SettingsEmptyPlaceholder>
        <Trans>No connected agents yet</Trans>
      </SettingsEmptyPlaceholder>
    );
  }

  return (
    <Table>
      <TableRow gridAutoColumns={GRID_AUTO_COLUMNS}>
        <TableHeader>
          <Trans>Name</Trans>
        </TableHeader>
        <TableHeader>
          <Trans>Status</Trans>
        </TableHeader>
        <TableHeader>
          <Trans>Last seen</Trans>
        </TableHeader>
        <TableHeader>
          <Trans>Role</Trans>
        </TableHeader>
        <TableHeader></TableHeader>
      </TableRow>
      <StyledTableBodyContainer>
        <TableBody>
          {connectedAgents.map((agent) => (
            <TableRow
              key={agent.id}
              gridAutoColumns={GRID_AUTO_COLUMNS}
              to={getSettingsPath(SettingsPath.ConnectedAgentDetail, {
                connectedAgentId: agent.id,
              })}
            >
              <TableCell
                color={theme.font.color.primary}
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
                clickable
              >
                <StyledEllipsisLabel>
                  {agent.name || t`Unnamed agent`}
                </StyledEllipsisLabel>
              </TableCell>

              <TableCell clickable>
                <ConnectedAgentStatusCell
                  status={agent.status}
                  lastSeenAt={agent.lastSeenAt}
                />
              </TableCell>

              <TableCell
                color={theme.font.color.tertiary}
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
                clickable
              >
                <StyledEllipsisLabel>
                  {agent.lastSeenAt
                    ? beautifyPastDateRelativeToNowShort(
                        new Date(agent.lastSeenAt),
                      )
                    : t`Never`}
                </StyledEllipsisLabel>
              </TableCell>

              <TableCell
                color={theme.font.color.tertiary}
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
                clickable
              >
                <StyledEllipsisLabel>
                  {agent.role?.label ?? '—'}
                </StyledEllipsisLabel>
              </TableCell>

              <TableCell align="right">
                <IconChevronRight
                  size={theme.icon.size.md}
                  color={theme.font.color.tertiary}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </StyledTableBodyContainer>
    </Table>
  );
};
