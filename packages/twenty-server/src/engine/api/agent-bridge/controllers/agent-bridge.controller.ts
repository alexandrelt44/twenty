import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';

import { type Request } from 'express';

import { AgentBridgeConnectResponse } from 'src/engine/api/agent-bridge/dtos/agent-bridge-connect.dto';
import { ReportAgentEventInput } from 'src/engine/api/agent-bridge/dtos/report-agent-event.input';
import { AgentBridgeGuard } from 'src/engine/api/agent-bridge/guards/agent-bridge.guard';
import { AgentBridgeService } from 'src/engine/api/agent-bridge/services/agent-bridge.service';
import { type ConnectedAgentEntity } from 'src/engine/core-modules/connected-agent/connected-agent.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { FlatWorkspace } from 'src/engine/core-modules/workspace/types/flat-workspace.type';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@Controller('agent-bridge')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard, AgentBridgeGuard)
export class AgentBridgeController {
  constructor(private readonly agentBridgeService: AgentBridgeService) {}

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  async connect(
    @Req() req: Request,
    @AuthWorkspace() workspace: FlatWorkspace,
  ): Promise<AgentBridgeConnectResponse> {
    const agent = req.connectedAgent as ConnectedAgentEntity;

    return this.agentBridgeService.connect(agent, workspace.id);
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  async heartbeat(
    @Req() req: Request,
    @AuthWorkspace() workspace: FlatWorkspace,
  ): Promise<void> {
    await this.agentBridgeService.heartbeat(
      req.connectedAgent as ConnectedAgentEntity,
      workspace.id,
    );
  }

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async reportEvent(
    @Req() req: Request,
    @AuthWorkspace() workspace: FlatWorkspace,
    @Body() input: ReportAgentEventInput,
  ): Promise<void> {
    await this.agentBridgeService.reportEvent(
      req.connectedAgent as ConnectedAgentEntity,
      workspace.id,
      input,
    );
  }
}
