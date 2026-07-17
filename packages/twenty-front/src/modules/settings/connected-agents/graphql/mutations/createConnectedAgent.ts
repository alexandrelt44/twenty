import gql from 'graphql-tag';

export const CREATE_CONNECTED_AGENT = gql`
  mutation CreateConnectedAgent($input: CreateConnectedAgentInput!) {
    createConnectedAgent(input: $input) {
      connectedAgent {
        id
        name
      }
      token
    }
  }
`;
