import gql from 'graphql-tag';

export const SET_CONNECTED_AGENT_STATUS = gql`
  mutation SetConnectedAgentStatus($input: SetConnectedAgentStatusInput!) {
    setConnectedAgentStatus(input: $input) {
      id
      status
    }
  }
`;
