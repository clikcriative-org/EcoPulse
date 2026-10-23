import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemberDto, UpdateMemberDto } from './dto';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query?: {
    status?: string;
    search?: string;
    isVolunteer?: boolean;
    isLeader?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (query?.status) where.status = query.status;
    if (query?.isVolunteer !== undefined) where.isVolunteer = query.isVolunteer;
    if (query?.isLeader !== undefined) where.isLeader = query.isLeader;
    if (query?.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          birthDate: true,
          gender: true,
          status: true,
          isVolunteer: true,
          isLeader: true,
          photoUrl: true,
          memberSince: true,
          city: true,
          createdAt: true,
        },
      }),
      this.prisma.member.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, tenantId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id, tenantId },
      include: {
        familyMembers: {
          include: { family: { include: { members: { include: { member: { select: { id: true, fullName: true, photoUrl: true } } } } } } },
        },
        ministryMembers: {
          include: { ministry: { select: { id: true, name: true, color: true } } },
        },
        groupMembers: {
          include: { group: { select: { id: true, name: true, type: true } } },
        },
        tags: {
          include: { tag: { select: { id: true, name: true, color: true } } },
        },
        donations: {
          orderBy: { donatedAt: 'desc' },
          take: 5,
          select: { id: true, type: true, amountCents: true, donatedAt: true },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Membro não encontrado');
    }

    return member;
  }

  async create(tenantId: string, dto: CreateMemberDto) {
    return this.prisma.member.create({
      data: {
        tenantId,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        gender: (dto.gender as any) || 'NOT_INFORMED',
        maritalStatus: (dto.maritalStatus as any) || 'NOT_INFORMED',
        street: dto.street,
        number: dto.number,
        complement: dto.complement,
        neighborhood: dto.neighborhood,
        city: dto.city,
        state: dto.state,
        zipCode: dto.zipCode,
        memberSince: dto.memberSince ? new Date(dto.memberSince) : null,
        baptismDate: dto.baptismDate ? new Date(dto.baptismDate) : null,
        salvationDate: dto.salvationDate ? new Date(dto.salvationDate) : null,
        isVolunteer: dto.isVolunteer || false,
        isLeader: dto.isLeader || false,
        photoUrl: dto.photoUrl,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateMemberDto) {
    await this.findById(id, tenantId);

    const data: any = {};
    if (dto.fullName) data.fullName = dto.fullName;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.birthDate) data.birthDate = new Date(dto.birthDate);
    if (dto.gender) data.gender = dto.gender;
    if (dto.maritalStatus) data.maritalStatus = dto.maritalStatus;
    if (dto.street !== undefined) data.street = dto.street;
    if (dto.number !== undefined) data.number = dto.number;
    if (dto.complement !== undefined) data.complement = dto.complement;
    if (dto.neighborhood !== undefined) data.neighborhood = dto.neighborhood;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.zipCode !== undefined) data.zipCode = dto.zipCode;
    if (dto.memberSince) data.memberSince = new Date(dto.memberSince);
    if (dto.baptismDate) data.baptismDate = new Date(dto.baptismDate);
    if (dto.salvationDate) data.salvationDate = new Date(dto.salvationDate);
    if (dto.isVolunteer !== undefined) data.isVolunteer = dto.isVolunteer;
    if (dto.isLeader !== undefined) data.isLeader = dto.isLeader;
    if (dto.photoUrl !== undefined) data.photoUrl = dto.photoUrl;
    if (dto.status) data.status = dto.status;

    return this.prisma.member.update({ where: { id }, data });
  }

  async remove(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    await this.prisma.member.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    return { message: 'Membro desativado com sucesso' };
  }

  async getStats(tenantId: string) {
    const [total, active, volunteers, leaders, baptized] = await Promise.all([
      this.prisma.member.count({ where: { tenantId } }),
      this.prisma.member.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.member.count({ where: { tenantId, isVolunteer: true, status: 'ACTIVE' } }),
      this.prisma.member.count({ where: { tenantId, isLeader: true, status: 'ACTIVE' } }),
      this.prisma.member.count({ where: { tenantId, baptismDate: { not: null } } }),
    ]);

    // Birthdays this month
    const now = new Date();
    const month = now.getMonth() + 1;
    const birthdaysThisMonth = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM members WHERE tenant_id = $1 AND EXTRACT(MONTH FROM birth_date) = $2 AND status = 'ACTIVE'`,
      tenantId,
      month,
    );

    return {
      total,
      active,
      volunteers,
      leaders,
      baptized,
      birthdaysThisMonth: Number(birthdaysThisMonth[0]?.count || 0),
    };
  }

  async getBirthdays(tenantId: string) {
    const now = new Date();
    const month = now.getMonth() + 1;

    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, full_name, birth_date, phone, photo_url
       FROM members
       WHERE tenant_id = $1 AND EXTRACT(MONTH FROM birth_date) = $2 AND status = 'ACTIVE'
       ORDER BY EXTRACT(DAY FROM birth_date) ASC`,
      tenantId,
      month,
    );
  }
}
