import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Listar usuários da igreja' })
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.usersService.findAllByTenant(tenantId);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  async findOne(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.usersService.findById(id, tenantId);
  }
}
