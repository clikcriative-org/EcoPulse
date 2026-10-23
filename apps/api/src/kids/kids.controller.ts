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
import { KidsService } from './kids.service';
import { CreateChildDto, UpdateChildDto, CheckInDto, CheckOutDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Kids')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kids')
export class KidsController {
  constructor(private readonly kidsService: KidsService) {}

  // ── Children CRUD ──

  @Get('children')
  @ApiOperation({ summary: 'Listar crianças cadastradas' })
  @ApiQuery({ name: 'ageGroup', required: false })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('ageGroup') ageGroup?: string,
  ) {
    return this.kidsService.findAll(tenantId, { ageGroup });
  }

  @Get('children/:id')
  @ApiOperation({ summary: 'Buscar criança por ID com histórico' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.kidsService.findById(id, tenantId);
  }

  @Post('children')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER', 'VOLUNTEER')
  @ApiOperation({ summary: 'Cadastrar nova criança' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateChildDto,
  ) {
    return this.kidsService.create(tenantId, dto);
  }

  @Patch('children/:id')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER', 'VOLUNTEER')
  @ApiOperation({ summary: 'Atualizar dados da criança' })
  async update(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateChildDto,
  ) {
    return this.kidsService.update(id, tenantId, dto);
  }

  @Delete('children/:id')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Desativar criança (soft delete)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.kidsService.remove(id, tenantId);
  }

  // ── Check-in / Check-out ──

  @Post('checkin')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER', 'VOLUNTEER')
  @ApiOperation({ summary: 'Realizar check-in de criança' })
  async checkIn(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CheckInDto,
  ) {
    return this.kidsService.checkIn(tenantId, dto, userId);
  }

  @Post('checkout/:checkInId')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER', 'VOLUNTEER')
  @ApiOperation({ summary: 'Realizar check-out com código de segurança' })
  async checkOut(
    @Param('checkInId') checkInId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CheckOutDto,
  ) {
    return this.kidsService.checkOut(tenantId, checkInId, dto.securityCode, dto.checkedOutBy);
  }

  @Get('active')
  @ApiOperation({ summary: 'Listar crianças com check-in ativo (presentes agora)' })
  async getActive(@CurrentUser('tenantId') tenantId: string) {
    return this.kidsService.getActiveCheckIns(tenantId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Histórico de check-ins do dia' })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD' })
  async getHistory(
    @CurrentUser('tenantId') tenantId: string,
    @Query('date') date?: string,
  ) {
    return this.kidsService.getCheckInHistory(tenantId, date);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas do módulo Kids' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    return this.kidsService.getStats(tenantId);
  }
}
