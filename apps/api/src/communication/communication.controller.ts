import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CommunicationService } from './communication.service';
import { CreateTemplateDto, UpdateTemplateDto, SendMessageDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Communication')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('communication')
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  // ── Templates ──

  @Get('templates')
  @ApiOperation({ summary: 'Listar templates de mensagem' })
  @ApiQuery({ name: 'channel', required: false })
  async findAllTemplates(
    @CurrentUser('tenantId') tenantId: string,
    @Query('channel') channel?: string,
  ) {
    return this.communicationService.findAllTemplates(tenantId, channel);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Buscar template por ID' })
  async findTemplate(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.communicationService.findTemplateById(id, tenantId);
  }

  @Post('templates')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Criar template de mensagem' })
  async createTemplate(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.communicationService.createTemplate(tenantId, dto);
  }

  @Patch('templates/:id')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Atualizar template' })
  async updateTemplate(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.communicationService.updateTemplate(id, tenantId, dto);
  }

  @Delete('templates/:id')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Desativar template' })
  async deleteTemplate(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.communicationService.deleteTemplate(id, tenantId);
  }

  // ── Messages ──

  @Post('send')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER')
  @ApiOperation({ summary: 'Enviar mensagem para destinatários' })
  async sendMessage(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.communicationService.sendMessage(tenantId, dto);
  }

  @Get('messages')
  @ApiOperation({ summary: 'Histórico de mensagens enviadas' })
  @ApiQuery({ name: 'channel', required: false })
  @ApiQuery({ name: 'page', required: false })
  async getHistory(
    @CurrentUser('tenantId') tenantId: string,
    @Query('channel') channel?: string,
    @Query('page') page?: string,
  ) {
    return this.communicationService.getMessageHistory(tenantId, {
      channel,
      page: page ? parseInt(page) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de comunicação' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    return this.communicationService.getStats(tenantId);
  }

  // ── Notifications ──

  @Get('notifications')
  @ApiOperation({ summary: 'Listar notificações do usuário' })
  async getNotifications(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.communicationService.getNotifications(tenantId, userId);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Marcar notificação como lida' })
  async markRead(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.communicationService.markNotificationRead(id, tenantId);
  }

  @Get('notifications/unread')
  @ApiOperation({ summary: 'Contagem de notificações não lidas' })
  async getUnreadCount(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.communicationService.getUnreadCount(tenantId, userId);
  }
}
