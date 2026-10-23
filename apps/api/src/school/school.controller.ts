import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SchoolService } from './school.service';
import { CreateCourseDto, UpdateCourseDto, CreateLessonDto, EnrollDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('School')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('school')
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  @Get('courses')
  @ApiOperation({ summary: 'Listar cursos' })
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.schoolService.findAllCourses(tenantId);
  }

  @Get('courses/:id')
  @ApiOperation({ summary: 'Detalhes do curso com aulas e alunos' })
  async findOne(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.schoolService.findCourseById(id, tenantId);
  }

  @Post('courses')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Criar curso' })
  async create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateCourseDto) {
    return this.schoolService.createCourse(tenantId, dto);
  }

  @Patch('courses/:id')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Atualizar curso' })
  async update(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @Body() dto: UpdateCourseDto) {
    return this.schoolService.updateCourse(id, tenantId, dto);
  }

  // ── Lessons ──

  @Post('courses/:id/lessons')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Adicionar aula ao curso' })
  async addLesson(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @Body() dto: CreateLessonDto) {
    return this.schoolService.addLesson(id, tenantId, dto);
  }

  @Delete('courses/:courseId/lessons/:lessonId')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Remover aula' })
  async deleteLesson(
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.schoolService.deleteLesson(lessonId, courseId, tenantId);
  }

  // ── Enrollments ──

  @Post('courses/:id/enroll')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER')
  @ApiOperation({ summary: 'Matricular membro no curso' })
  async enroll(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string, @Body() dto: EnrollDto) {
    return this.schoolService.enroll(id, tenantId, dto);
  }

  @Delete('courses/:id/enroll/:memberId')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN', 'LEADER')
  @ApiOperation({ summary: 'Cancelar matrícula' })
  async unenroll(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.schoolService.unenroll(id, memberId, tenantId);
  }

  @Post('courses/:id/complete/:memberId')
  @Roles('SUPER_ADMIN', 'PASTOR', 'ADMIN')
  @ApiOperation({ summary: 'Marcar curso como concluído e gerar certificado' })
  async complete(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.schoolService.completeCourse(id, memberId, tenantId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas da escola' })
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    return this.schoolService.getStats(tenantId);
  }
}
