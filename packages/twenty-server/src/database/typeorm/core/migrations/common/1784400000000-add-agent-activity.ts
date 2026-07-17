import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgentActivity1784400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."agentActivity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "connectedAgentId" uuid NOT NULL, "type" text NOT NULL, "summary" text NOT NULL, "payload" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_AGENT_ACTIVITY_ID" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_ACTIVITY_WORKSPACE_ID" ON "core"."agentActivity" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_AGENT_ACTIVITY_CONNECTED_AGENT_ID" ON "core"."agentActivity" ("connectedAgentId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."agentActivity" ADD CONSTRAINT "FK_AGENT_ACTIVITY_WORKSPACE_ID" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."agentActivity" ADD CONSTRAINT "FK_AGENT_ACTIVITY_CONNECTED_AGENT_ID" FOREIGN KEY ("connectedAgentId") REFERENCES "core"."connectedAgent"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "core"."agentActivity"`);
  }
}
