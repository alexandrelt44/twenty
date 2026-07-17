import { Field, ObjectType } from '@nestjs/graphql';

import { IDField } from '@ptc-org/nestjs-query-graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { AgentActivityType } from 'src/engine/core-modules/connected-agent/enums/agent-activity-type.enum';
import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

@Index('IDX_AGENT_ACTIVITY_WORKSPACE_ID', ['workspaceId'])
@Index('IDX_AGENT_ACTIVITY_CONNECTED_AGENT_ID', ['connectedAgentId'])
@Entity({ name: 'agentActivity', schema: 'core' })
@ObjectType('AgentActivity')
export class AgentActivityEntity extends WorkspaceRelatedEntity {
  @IDField(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  connectedAgentId: string;

  @ManyToOne(() => ConnectedAgentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connectedAgentId' })
  connectedAgent: Relation<ConnectedAgentEntity>;

  @Field(() => AgentActivityType)
  @Column({ type: 'text' })
  type: AgentActivityType;

  @Field()
  @Column({ type: 'text' })
  summary: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @Field(() => Date)
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
