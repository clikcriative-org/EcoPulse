import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Dados da igreja atual' })
  async getCurrent(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantsService.findById(tenantId);
  }

  @Patch('current')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Atualizar dados da igreja' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Body() data: { name?: string; logoUrl?: string; primaryColor?: string },
  ) {
    return this.tenantsService.update(tenantId, data);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Métricas do dashboard' })
  async dashboard(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantsService.getDashboardStats(tenantId);
  }
}
