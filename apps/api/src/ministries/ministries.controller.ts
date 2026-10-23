import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MinistriesService } from './ministries.service';
import { CreateMinistryDto, UpdateMinistryDto, AddVolunteerDto, UpdateVolunteerDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Ministries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ministries')
export class MinistriesController {
  constructor(private readonly ministriesService: MinistriesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar ministérios' })
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.ministriesService.findAll(tenantId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de ministérios' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    return this.ministriesService.getStats(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes do ministério com voluntários' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.ministriesService.findById(id, tenantId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Criar novo ministério' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateMinistryDto,
  ) {
    return this.ministriesService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER')
  @ApiOperation({ summary: 'Atualizar ministério' })
  async update(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateMinistryDto,
  ) {
    return this.ministriesService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Desativar ministério' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.ministriesService.remove(id, tenantId);
  }

  // ── Volunteers ──

  @Post(':id/volunteers')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER')
  @ApiOperation({ summary: 'Adicionar voluntário ao ministério' })
  async addVolunteer(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: AddVolunteerDto,
  ) {
    return this.ministriesService.addVolunteer(id, tenantId, dto);
  }

  @Patch(':id/volunteers/:memberId')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER')
  @ApiOperation({ summary: 'Atualizar papel do voluntário' })
  async updateVolunteer(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateVolunteerDto,
  ) {
    return this.ministriesService.updateVolunteer(id, memberId, tenantId, dto);
  }

  @Delete(':id/volunteers/:memberId')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER')
  @ApiOperation({ summary: 'Remover voluntário do ministério' })
  async removeVolunteer(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.ministriesService.removeVolunteer(id, memberId, tenantId);
  }
}
