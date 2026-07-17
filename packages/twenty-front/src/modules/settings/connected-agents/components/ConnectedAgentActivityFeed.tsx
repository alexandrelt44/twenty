import { SettingsEmptyPlaceholder } from '@/settings/components/SettingsEmptyPlaceholder';
import { Table } from '@/ui/layout/table/components/Table';
import { TableBody } from '@/ui/layout/table/components/TableBody';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useContext } from 'react';
import { ThemeContext, themeCssVariables } from 'twenty-ui/theme-constants';
import { useQuery } from '@apollo/client/react';
import { GetConnectedAgentActivityDocument } from '~/generated-metadata/graphql';
import { beautifyPastDateRelativeToNowShort } from '~/utils/date-utils';

const StyledTableBodyContainer = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
`;

const StyledEllipsisLabel = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledTypePill = styled.span`
  background: ${themeCssVariables.background.transparent.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 2px 6px;
  text-transform: capitalize;
`;

const StyledPayload = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: monospace;
  font-size: ${themeCssVariables.font.size.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const GRID_AUTO_COLUMNS = '1fr 3fr 3fr 2fr';

type ConnectedAgentActivityFeedProps = {
  connectedAgentId: string;
};

export const ConnectedAgentActivityFeed = ({
  connectedAgentId,
}: ConnectedAgentActivityFeedProps) => {
  const { t } = useLingui();
  const { theme } = useContext(ThemeContext);

  const { data, loading } = useQuery(GetConnectedAgentActivityDocument, {
    variables: {
      input: {
        connectedAgentId,
      },
    },
  });

  const activity = data?.connectedAgentActivity;

  if (loading && !activity) {
    return (
      <SettingsEmptyPlaceholder>
        <Trans>Loading activity...</Trans>
      </SettingsEmptyPlaceholder>
    );
  }

  if (!activity?.length) {
    return (
      <SettingsEmptyPlaceholder>
        <Trans>No activity yet</Trans>
      </SettingsEmptyPlaceholder>
    );
  }

  return (
    <Table>
      <TableRow gridAutoColumns={GRID_AUTO_COLUMNS}>
        <TableHeader>
          <Trans>Type</Trans>
        </TableHeader>
        <TableHeader>
          <Trans>Summary</Trans>
        </TableHeader>
        <TableHeader>
          <Trans>Payload</Trans>
        </TableHeader>
        <TableHeader>
          <Trans>When</Trans>
        </TableHeader>
      </TableRow>
      <StyledTableBodyContainer>
        <TableBody>
          {activity.map((item) => (
            <TableRow key={item.id} gridAutoColumns={GRID_AUTO_COLUMNS}>
              <TableCell>
                <StyledTypePill>{item.type.toLowerCase()}</StyledTypePill>
              </TableCell>
              <TableCell
                color={theme.font.color.primary}
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
              >
                <StyledEllipsisLabel>{item.summary}</StyledEllipsisLabel>
              </TableCell>
              <TableCell overflow="hidden" textOverflow="ellipsis">
                {/*
                  SECURITY: payload is a free-form JSON scalar self-reported
                  by the agent. It MUST be rendered as inert text only —
                  never via dangerouslySetInnerHTML.
                */}
                <StyledPayload>
                  {item.payload ? JSON.stringify(item.payload) : t`—`}
                </StyledPayload>
              </TableCell>
              <TableCell
                color={theme.font.color.tertiary}
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
              >
                <StyledEllipsisLabel>
                  {beautifyPastDateRelativeToNowShort(
                    new Date(item.createdAt),
                  )}
                </StyledEllipsisLabel>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </StyledTableBodyContainer>
    </Table>
  );
};
