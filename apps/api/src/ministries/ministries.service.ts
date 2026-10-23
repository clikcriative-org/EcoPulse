import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMinistryDto, UpdateMinistryDto, AddVolunteerDto, UpdateVolunteerDto } from './dto';

@Injectable()
export class MinistriesService {
  constructor(private prisma: PrismaService) {}

  // ── Ministries CRUD ──

  async findAll(tenantId: string) {
    return this.prisma.ministry.findMany({
      where: { tenantId, active: true },
      include: {
        _count: { select: { members: { where: { active: true } } } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const ministry = await this.prisma.ministry.findFirst({
      where: { id, tenantId },
      include: {
        members: {
          where: { active: true },
          include: {
            member: {
              select: { id: true, fullName: true, phone: true, email: true, photoUrl: true },
            },
          },
          orderBy: { role: 'asc' },
        },
      },
    });

    if (!ministry) {
      throw new NotFoundException('Ministério não encontrado');
    }

    return ministry;
  }

  async create(tenantId: string, dto: CreateMinistryDto) {
    return this.prisma.ministry.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        color: dto.color || '#10b981',
        iconName: dto.iconName,
        leaderId: dto.leaderId,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateMinistryDto) {
    await this.findById(id, tenantId);

    const data: any = {};
    if (dto.name) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.color) data.color = dto.color;
    if (dto.iconName !== undefined) data.iconName = dto.iconName;
    if (dto.leaderId !== undefined) data.leaderId = dto.leaderId;
    if (dto.active !== undefined) data.active = dto.active;

    return this.prisma.ministry.update({ where: { id }, data });
  }

  async remove(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    await this.prisma.ministry.update({
      where: { id },
      data: { active: false },
    });
    return { message: 'Ministério desativado com sucesso' };
  }

  // ── Volunteers ──

  async addVolunteer(ministryId: string, tenantId: string, dto: AddVolunteerDto) {
    // Verify ministry belongs to tenant
    await this.findById(ministryId, tenantId);

    // Check if already a member
    const existing = await this.prisma.ministryMember.findUnique({
      where: { memberId_ministryId: { memberId: dto.memberId, ministryId } },
    });

    if (existing) {
      if (existing.active) {
        throw new ConflictException('Membro já faz parte deste ministério');
      }
      // Reactivate
      return this.prisma.ministryMember.update({
        where: { id: existing.id },
        data: { active: true, role: dto.role || 'volunteer', function: dto.function },
      });
    }

    return this.prisma.ministryMember.create({
      data: {
        memberId: dto.memberId,
        ministryId,
        role: dto.role || 'volunteer',
        function: dto.function,
      },
    });
  }

  async updateVolunteer(ministryId: string, memberId: string, tenantId: string, dto: UpdateVolunteerDto) {
    await this.findById(ministryId, tenantId);

    const volunteer = await this.prisma.ministryMember.findUnique({
      where: { memberId_ministryId: { memberId, ministryId } },
    });

    if (!volunteer) {
      throw new NotFoundException('Voluntário não encontrado neste ministério');
    }

    const data: any = {};
    if (dto.role) data.role = dto.role;
    if (dto.function !== undefined) data.function = dto.function;
    if (dto.active !== undefined) data.active = dto.active;

    return this.prisma.ministryMember.update({
      where: { id: volunteer.id },
      data,
    });
  }

  async removeVolunteer(ministryId: string, memberId: string, tenantId: string) {
    await this.findById(ministryId, tenantId);

    const volunteer = await this.prisma.ministryMember.findUnique({
      where: { memberId_ministryId: { memberId, ministryId } },
    });

    if (!volunteer) {
      throw new NotFoundException('Voluntário não encontrado');
    }

    await this.prisma.ministryMember.update({
      where: { id: volunteer.id },
      data: { active: false },
    });

    return { message: 'Voluntário removido do ministério' };
  }

  async getStats(tenantId: string) {
    const [totalMinistries, totalVolunteers] = await Promise.all([
      this.prisma.ministry.count({ where: { tenantId, active: true } }),
      this.prisma.ministryMember.count({
        where: { ministry: { tenantId }, active: true },
      }),
    ]);

    // Top ministries by member count
    const topMinistries = await this.prisma.ministry.findMany({
      where: { tenantId, active: true },
      include: { _count: { select: { members: { where: { active: true } } } } },
      orderBy: { members: { _count: 'desc' } },
      take: 5,
    });

    return { totalMinistries, totalVolunteers, topMinistries };
  }
}
