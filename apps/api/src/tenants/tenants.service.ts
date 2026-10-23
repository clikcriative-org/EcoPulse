import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!tenant) {
      throw new NotFoundException('Igreja não encontrada');
    }

    return tenant;
  }

  async update(id: string, data: { name?: string; logoUrl?: string; primaryColor?: string }) {
    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  async getDashboardStats(tenantId: string) {
    const [members, volunteers, leaders, ministries, groups] = await Promise.all([
      this.prisma.member.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.member.count({ where: { tenantId, isVolunteer: true, status: 'ACTIVE' } }),
      this.prisma.member.count({ where: { tenantId, isLeader: true, status: 'ACTIVE' } }),
      this.prisma.ministry.count({ where: { tenantId, active: true } }),
      this.prisma.group.count({ where: { tenantId, active: true } }),
    ]);

    return { members, volunteers, leaders, ministries, groups };
  }
}
