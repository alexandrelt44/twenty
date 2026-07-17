import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConnectedAgent1784227200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "core"."connectedAgent" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "name" character varying NOT NULL, "description" text, "apiKeyId" uuid NOT NULL, "status" text NOT NULL DEFAULT 'ACTIVE', "lastSeenAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_CONNECTED_AGENT_ID" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CONNECTED_AGENT_WORKSPACE_ID" ON "core"."connectedAgent" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_CONNECTED_AGENT_API_KEY_ID" ON "core"."connectedAgent" ("apiKeyId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."connectedAgent" ADD CONSTRAINT "FK_CONNECTED_AGENT_WORKSPACE_ID" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."connectedAgent" ADD CONSTRAINT "FK_CONNECTED_AGENT_API_KEY_ID" FOREIGN KEY ("apiKeyId") REFERENCES "core"."apiKey"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "core"."connectedAgent"`);
  }
}
