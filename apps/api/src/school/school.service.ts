import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto, UpdateCourseDto, CreateLessonDto, EnrollDto } from './dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SchoolService {
  constructor(private prisma: PrismaService) {}

  // ── Courses ──

  async findAllCourses(tenantId: string) {
    return this.prisma.course.findMany({
      where: { tenantId, active: true },
      include: {
        _count: { select: { enrollments: true, lessons: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findCourseById(id: string, tenantId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, tenantId },
      include: {
        lessons: { orderBy: { order: 'asc' } },
        enrollments: {
          include: { member: { select: { id: true, fullName: true, photoUrl: true } } },
          orderBy: { enrolledAt: 'desc' },
        },
        _count: { select: { enrollments: true, lessons: true, certificates: true } },
      },
    });
    if (!course) throw new NotFoundException('Curso não encontrado');
    return course;
  }

  async createCourse(tenantId: string, dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        mode: dto.mode || 'presential',
        maxStudents: dto.maxStudents,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
      },
    });
  }

  async updateCourse(id: string, tenantId: string, dto: UpdateCourseDto) {
    await this.findCourseById(id, tenantId);
    const data: any = {};
    if (dto.name) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.mode) data.mode = dto.mode;
    if (dto.maxStudents !== undefined) data.maxStudents = dto.maxStudents;
    if (dto.startAt) data.startAt = new Date(dto.startAt);
    if (dto.endAt) data.endAt = new Date(dto.endAt);
    if (dto.active !== undefined) data.active = dto.active;
    return this.prisma.course.update({ where: { id }, data });
  }

  // ── Lessons ──

  async addLesson(courseId: string, tenantId: string, dto: CreateLessonDto) {
    await this.findCourseById(courseId, tenantId);
    return this.prisma.lesson.create({
      data: {
        courseId,
        title: dto.title,
        content: dto.content,
        videoUrl: dto.videoUrl,
        order: dto.order,
        duration: dto.duration,
        date: dto.date ? new Date(dto.date) : null,
      },
    });
  }

  async deleteLesson(lessonId: string, courseId: string, tenantId: string) {
    await this.findCourseById(courseId, tenantId);
    await this.prisma.lesson.delete({ where: { id: lessonId } });
    return { message: 'Aula removida' };
  }

  // ── Enrollments ──

  async enroll(courseId: string, tenantId: string, dto: EnrollDto) {
    await this.findCourseById(courseId, tenantId);

    const existing = await this.prisma.courseEnrollment.findUnique({
      where: { courseId_memberId: { courseId, memberId: dto.memberId } },
    });

    if (existing) {
      if (existing.status === 'ACTIVE') {
        throw new ConflictException('Membro já está matriculado neste curso');
      }
      return this.prisma.courseEnrollment.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', progress: 0 },
      });
    }

    return this.prisma.courseEnrollment.create({
      data: { courseId, memberId: dto.memberId },
    });
  }

  async unenroll(courseId: string, memberId: string, tenantId: string) {
    await this.findCourseById(courseId, tenantId);
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { courseId_memberId: { courseId, memberId } },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada');

    await this.prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: { status: 'DROPPED' },
    });
    return { message: 'Matrícula cancelada' };
  }

  async completeCourse(courseId: string, memberId: string, tenantId: string) {
    await this.findCourseById(courseId, tenantId);
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { courseId_memberId: { courseId, memberId } },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada');

    // Mark as completed
    await this.prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: { status: 'COMPLETED', progress: 100, completedAt: new Date() },
    });

    // Generate certificate
    const code = `CERT-${uuidv4().slice(0, 8).toUpperCase()}`;
    const certificate = await this.prisma.certificate.create({
      data: { courseId, memberId, code },
    });

    return { message: 'Curso concluído! Certificado gerado.', certificate };
  }

  async getStats(tenantId: string) {
    const [totalCourses, totalEnrollments, totalCompleted, totalCertificates] = await Promise.all([
      this.prisma.course.count({ where: { tenantId, active: true } }),
      this.prisma.courseEnrollment.count({ where: { course: { tenantId }, status: 'ACTIVE' } }),
      this.prisma.courseEnrollment.count({ where: { course: { tenantId }, status: 'COMPLETED' } }),
      this.prisma.certificate.count({ where: { course: { tenantId } } }),
    ]);
    return { totalCourses, totalEnrollments, totalCompleted, totalCertificates };
  }
}
