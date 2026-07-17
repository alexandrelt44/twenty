import gql from 'graphql-tag';

export const CONNECTED_AGENT_FRAGMENT = gql`
  fragment ConnectedAgentFragment on ConnectedAgent {
    id
    name
    description
    status
    lastSeenAt
    createdAt
    role {
      id
      label
      icon
    }
  }
`;
