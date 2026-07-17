import gql from 'graphql-tag';
import { CONNECTED_AGENT_FRAGMENT } from '@/settings/connected-agents/graphql/fragments/connectedAgentFragment';

export const GET_CONNECTED_AGENT = gql`
  query GetConnectedAgent($input: GetConnectedAgentInput!) {
    connectedAgent(input: $input) {
      ...ConnectedAgentFragment
    }
  }
  ${CONNECTED_AGENT_FRAGMENT}
`;
