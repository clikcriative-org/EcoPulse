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
import { MembersService } from './members.service';
import { CreateMemberDto, UpdateMemberDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar membros com filtros e paginação' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'isVolunteer', required: false })
  @ApiQuery({ name: 'isLeader', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('isVolunteer') isVolunteer?: string,
    @Query('isLeader') isLeader?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.membersService.findAll(tenantId, {
      search,
      status,
      isVolunteer: isVolunteer === 'true' ? true : undefined,
      isLeader: isLeader === 'true' ? true : undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de membros' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    return this.membersService.getStats(tenantId);
  }

  @Get('birthdays')
  @ApiOperation({ summary: 'Aniversariantes do mês' })
  async getBirthdays(@CurrentUser('tenantId') tenantId: string) {
    return this.membersService.getBirthdays(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar membro por ID com relacionamentos' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.membersService.findById(id, tenantId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER')
  @ApiOperation({ summary: 'Cadastrar novo membro' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateMemberDto,
  ) {
    return this.membersService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER')
  @ApiOperation({ summary: 'Atualizar dados do membro' })
  async update(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.membersService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Desativar membro (soft delete)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.membersService.remove(id, tenantId);
  }
}
