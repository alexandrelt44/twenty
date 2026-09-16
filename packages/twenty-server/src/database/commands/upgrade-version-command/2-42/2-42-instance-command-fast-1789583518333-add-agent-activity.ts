import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

// IF NOT EXISTS guards keep this idempotent for fork databases that already
// ran the pre-2.42 TypeORM migration creating the same table.
@RegisteredInstanceCommand('2.42.0', 1789583518333)
export class AddAgentActivityFastInstanceCommand implements FastInstanceCommand {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "core"."agentActivity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "connectedAgentId" uuid NOT NULL, "type" text NOT NULL, "summary" text NOT NULL, "payload" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_AGENT_ACTIVITY_ID" PRIMARY KEY ("id"), CONSTRAINT "FK_AGENT_ACTIVITY_WORKSPACE_ID" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE, CONSTRAINT "FK_AGENT_ACTIVITY_CONNECTED_AGENT_ID" FOREIGN KEY ("connectedAgentId") REFERENCES "core"."connectedAgent"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_AGENT_ACTIVITY_WORKSPACE_ID" ON "core"."agentActivity" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_AGENT_ACTIVITY_CONNECTED_AGENT_ID" ON "core"."agentActivity" ("connectedAgentId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."agentActivity"`);
  }
}
