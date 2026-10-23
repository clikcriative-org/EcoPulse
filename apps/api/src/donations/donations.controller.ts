import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DonationsService } from './donations.service';
import { CreateDonationDto, CreateCampaignDto, UpdateCampaignDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Donations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Registrar nova doação' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateDonationDto,
  ) {
    return this.donationsService.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar doações com filtros' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'page', required: false })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('type') type?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('page') page?: string,
  ) {
    return this.donationsService.findAll(tenantId, {
      type,
      month: month ? parseInt(month) : undefined,
      year: year ? parseInt(year) : undefined,
      page: page ? parseInt(page) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas financeiras' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    return this.donationsService.getStats(tenantId);
  }

  // ── Campaigns ──

  @Get('campaigns')
  @ApiOperation({ summary: 'Listar campanhas' })
  async findAllCampaigns(@CurrentUser('tenantId') tenantId: string) {
    return this.donationsService.findAllCampaigns(tenantId);
  }

  @Post('campaigns')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Criar campanha de doação' })
  async createCampaign(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.donationsService.createCampaign(tenantId, dto);
  }

  @Patch('campaigns/:id')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Atualizar campanha' })
  async updateCampaign(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.donationsService.updateCampaign(id, tenantId, dto);
  }
}
