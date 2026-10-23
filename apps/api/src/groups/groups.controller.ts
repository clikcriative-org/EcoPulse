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
import { GroupsService } from './groups.service';
import { CreateGroupDto, UpdateGroupDto, AddGroupMemberDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar grupos e células' })
  @ApiQuery({ name: 'type', required: false })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('type') type?: string,
  ) {
    return this.groupsService.findAll(tenantId, type);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de grupos' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    return this.groupsService.getStats(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes do grupo com membros' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.groupsService.findById(id, tenantId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER')
  @ApiOperation({ summary: 'Criar novo grupo/célula' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groupsService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER')
  @ApiOperation({ summary: 'Atualizar grupo' })
  async update(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Desativar grupo' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.groupsService.remove(id, tenantId);
  }

  // ── Members ──

  @Post(':id/members')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER')
  @ApiOperation({ summary: 'Adicionar membro ao grupo' })
  async addMember(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: AddGroupMemberDto,
  ) {
    return this.groupsService.addMember(id, tenantId, dto);
  }

  @Delete(':id/members/:memberId')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER')
  @ApiOperation({ summary: 'Remover membro do grupo' })
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.groupsService.removeMember(id, memberId, tenantId);
  }
}
