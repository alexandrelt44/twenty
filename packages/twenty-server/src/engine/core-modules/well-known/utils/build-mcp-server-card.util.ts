import { BRAND_EMAIL_IDENTITY } from 'twenty-emails';

import { MCP_PROTOCOL_VERSION } from 'src/engine/api/mcp/constants/mcp-protocol-version.const';

type BuildMcpServerCardArgs = {
  baseUrl: string;
  version: string;
};

export const buildMcpServerCard = ({
  baseUrl,
  version,
}: BuildMcpServerCardArgs) => ({
  $schema:
    'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
  name: 'com.twenty/twenty',
  version,
  title: BRAND_EMAIL_IDENTITY.name,
  description: `Read and write your ${BRAND_EMAIL_IDENTITY.name} data - companies, people, opportunities, tasks, notes and any custom objects - from AI assistants. Tools are discovered at runtime and scoped to the authenticated workspace.`,
  websiteUrl: BRAND_EMAIL_IDENTITY.websiteUrl,
  repository: {
    url: BRAND_EMAIL_IDENTITY.sourceCodeUrl,
    source: 'github',
  },
  remotes: [
    {
      type: 'streamable-http',
      url: `${baseUrl}/mcp`,
      supportedProtocolVersions: [MCP_PROTOCOL_VERSION],
      headers: [
        {
          name: 'Authorization',
          description:
            "Optional. Bearer <api-key> for static API-key auth. Omit to use OAuth 2.1, auto-discovered from this host's /.well-known/oauth-protected-resource and /.well-known/oauth-authorization-server.",
          isRequired: false,
          isSecret: true,
        },
      ],
    },
  ],
});
