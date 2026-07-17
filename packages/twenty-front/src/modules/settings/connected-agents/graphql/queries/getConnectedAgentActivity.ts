import gql from 'graphql-tag';

export const GET_CONNECTED_AGENT_ACTIVITY = gql`
  query GetConnectedAgentActivity($input: GetConnectedAgentActivityInput!) {
    connectedAgentActivity(input: $input) {
      id
      type
      summary
      payload
      createdAt
    }
  }
`;
