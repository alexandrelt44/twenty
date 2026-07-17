import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

import { AgentActivityType } from 'src/engine/core-modules/connected-agent/enums/agent-activity-type.enum';

export class ReportAgentEventInput {
  @IsEnum(AgentActivityType)
  type: AgentActivityType;

  @IsString()
  summary: string;

  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;
}
