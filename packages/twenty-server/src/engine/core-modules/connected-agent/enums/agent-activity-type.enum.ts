import { registerEnumType } from '@nestjs/graphql';

export enum AgentActivityType {
  PROMPT = 'PROMPT',
  ACTION = 'ACTION',
  NOTE = 'NOTE',
}

registerEnumType(AgentActivityType, {
  name: 'AgentActivityType',
});
