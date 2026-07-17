import gql from 'graphql-tag';

export const DELETE_CONNECTED_AGENT = gql`
  mutation DeleteConnectedAgent($input: DeleteConnectedAgentInput!) {
    deleteConnectedAgent(input: $input)
  }
`;
