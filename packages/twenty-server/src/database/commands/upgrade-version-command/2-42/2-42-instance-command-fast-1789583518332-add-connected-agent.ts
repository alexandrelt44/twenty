import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

// IF NOT EXISTS guards keep this idempotent for fork databases that already
// ran the pre-2.42 TypeORM migration creating the same table.
@RegisteredInstanceCommand('2.42.0', 1789583518332)
export class AddConnectedAgentFastInstanceCommand implements FastInstanceCommand {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "core"."connectedAgent" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "apiKeyId" uuid NOT NULL, "status" text NOT NULL DEFAULT 'ACTIVE', "lastSeenAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_CONNECTED_AGENT_ID" PRIMARY KEY ("id"), CONSTRAINT "FK_CONNECTED_AGENT_WORKSPACE_ID" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE, CONSTRAINT "FK_CONNECTED_AGENT_API_KEY_ID" FOREIGN KEY ("apiKeyId") REFERENCES "core"."apiKey"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_CONNECTED_AGENT_WORKSPACE_ID" ON "core"."connectedAgent" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_CONNECTED_AGENT_API_KEY_ID" ON "core"."connectedAgent" ("apiKeyId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."connectedAgent"`);
  }
}
