import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto, UpdateGroupDto, AddGroupMemberDto } from './dto';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, type?: string) {
    return this.prisma.group.findMany({
      where: {
        tenantId,
        active: true,
        ...(type && { type: type as any }),
      },
      include: {
        _count: { select: { members: { where: { active: true } } } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const group = await this.prisma.group.findFirst({
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

    if (!group) {
      throw new NotFoundException('Grupo não encontrado');
    }

    return group;
  }

  async create(tenantId: string, dto: CreateGroupDto) {
    return this.prisma.group.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        type: (dto.type as any) || 'CELL',
        leaderId: dto.leaderId,
        meetingDay: dto.meetingDay,
        meetingTime: dto.meetingTime,
        address: dto.address,
        maxMembers: dto.maxMembers,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateGroupDto) {
    await this.findById(id, tenantId);

    const data: any = {};
    if (dto.name) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.type) data.type = dto.type;
    if (dto.leaderId !== undefined) data.leaderId = dto.leaderId;
    if (dto.meetingDay !== undefined) data.meetingDay = dto.meetingDay;
    if (dto.meetingTime !== undefined) data.meetingTime = dto.meetingTime;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.maxMembers !== undefined) data.maxMembers = dto.maxMembers;
    if (dto.active !== undefined) data.active = dto.active;

    return this.prisma.group.update({ where: { id }, data });
  }

  async remove(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    await this.prisma.group.update({ where: { id }, data: { active: false } });
    return { message: 'Grupo desativado com sucesso' };
  }

  // ── Members ──

  async addMember(groupId: string, tenantId: string, dto: AddGroupMemberDto) {
    await this.findById(groupId, tenantId);

    const existing = await this.prisma.groupMember.findUnique({
      where: { memberId_groupId: { memberId: dto.memberId, groupId } },
    });

    if (existing) {
      if (existing.active) {
        throw new ConflictException('Membro já faz parte deste grupo');
      }
      return this.prisma.groupMember.update({
        where: { id: existing.id },
        data: { active: true, role: dto.role || 'member' },
      });
    }

    return this.prisma.groupMember.create({
      data: {
        memberId: dto.memberId,
        groupId,
        role: dto.role || 'member',
      },
    });
  }

  async removeMember(groupId: string, memberId: string, tenantId: string) {
    await this.findById(groupId, tenantId);

    const member = await this.prisma.groupMember.findUnique({
      where: { memberId_groupId: { memberId, groupId } },
    });

    if (!member) {
      throw new NotFoundException('Membro não encontrado neste grupo');
    }

    await this.prisma.groupMember.update({
      where: { id: member.id },
      data: { active: false },
    });

    return { message: 'Membro removido do grupo' };
  }

  async getStats(tenantId: string) {
    const [totalGroups, totalCells, totalMembers] = await Promise.all([
      this.prisma.group.count({ where: { tenantId, active: true } }),
      this.prisma.group.count({ where: { tenantId, active: true, type: 'CELL' } }),
      this.prisma.groupMember.count({
        where: { group: { tenantId }, active: true },
      }),
    ]);

    return { totalGroups, totalCells, totalMembers };
  }
}
