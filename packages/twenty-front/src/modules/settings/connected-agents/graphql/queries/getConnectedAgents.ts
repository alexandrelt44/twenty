import gql from 'graphql-tag';
import { CONNECTED_AGENT_FRAGMENT } from '@/settings/connected-agents/graphql/fragments/connectedAgentFragment';

export const GET_CONNECTED_AGENTS = gql`
  query GetConnectedAgents {
    connectedAgents {
      ...ConnectedAgentFragment
    }
  }
  ${CONNECTED_AGENT_FRAGMENT}
`;
