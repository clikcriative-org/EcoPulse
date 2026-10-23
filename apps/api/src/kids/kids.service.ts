import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChildDto, UpdateChildDto, CheckInDto } from './dto';

@Injectable()
export class KidsService {
  constructor(private prisma: PrismaService) {}

  // ── Children CRUD ──

  async findAll(tenantId: string, query?: { ageGroup?: string; active?: boolean }) {
    return this.prisma.child.findMany({
      where: {
        tenantId,
        active: query?.active ?? true,
        ...(query?.ageGroup && { ageGroup: query.ageGroup }),
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const child = await this.prisma.child.findFirst({
      where: { id, tenantId },
      include: {
        checkIns: {
          orderBy: { checkInAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!child) {
      throw new NotFoundException('Criança não encontrada');
    }

    return child;
  }

  async create(tenantId: string, dto: CreateChildDto) {
    return this.prisma.child.create({
      data: {
        tenantId,
        fullName: dto.fullName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        gender: (dto.gender as any) || 'NOT_INFORMED',
        allergies: dto.allergies,
        medicalNotes: dto.medicalNotes,
        parentName: dto.parentName,
        parentPhone: dto.parentPhone,
        parentMemberId: dto.parentMemberId,
        ageGroup: dto.ageGroup,
        photoUrl: dto.photoUrl,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateChildDto) {
    await this.findById(id, tenantId);

    return this.prisma.child.update({
      where: { id },
      data: {
        ...(dto.fullName && { fullName: dto.fullName }),
        ...(dto.birthDate && { birthDate: new Date(dto.birthDate) }),
        ...(dto.gender && { gender: dto.gender as any }),
        ...(dto.allergies !== undefined && { allergies: dto.allergies }),
        ...(dto.medicalNotes !== undefined && { medicalNotes: dto.medicalNotes }),
        ...(dto.parentName && { parentName: dto.parentName }),
        ...(dto.parentPhone && { parentPhone: dto.parentPhone }),
        ...(dto.parentMemberId !== undefined && { parentMemberId: dto.parentMemberId }),
        ...(dto.ageGroup !== undefined && { ageGroup: dto.ageGroup }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    await this.prisma.child.update({
      where: { id },
      data: { active: false },
    });
    return { message: 'Criança desativada com sucesso' };
  }

  // ── Check-in / Check-out ──

  async checkIn(tenantId: string, dto: CheckInDto, checkedInBy: string) {
    // Verify child exists and belongs to tenant
    const child = await this.prisma.child.findFirst({
      where: { id: dto.childId, tenantId, active: true },
    });

    if (!child) {
      throw new NotFoundException('Criança não encontrada');
    }

    // Check if already checked in (no checkout yet)
    const activeCheckIn = await this.prisma.childCheckIn.findFirst({
      where: { childId: dto.childId, checkOutAt: null },
    });

    if (activeCheckIn) {
      throw new BadRequestException('Criança já está com check-in ativo');
    }

    // Generate security code (6 chars alphanumeric)
    const securityCode = this.generateSecurityCode();

    const checkIn = await this.prisma.childCheckIn.create({
      data: {
        childId: dto.childId,
        checkedInBy,
        securityCode,
        room: dto.room,
        notes: dto.notes,
      },
      include: { child: true },
    });

    return {
      ...checkIn,
      message: `Check-in realizado. Código de segurança: ${securityCode}`,
    };
  }

  async checkOut(tenantId: string, checkInId: string, securityCode: string, checkedOutBy: string) {
    const checkIn = await this.prisma.childCheckIn.findFirst({
      where: { id: checkInId, checkOutAt: null },
      include: { child: true },
    });

    if (!checkIn) {
      throw new NotFoundException('Check-in não encontrado ou já finalizado');
    }

    // Verify tenant
    if (checkIn.child.tenantId !== tenantId) {
      throw new NotFoundException('Check-in não encontrado');
    }

    // Verify security code
    if (checkIn.securityCode !== securityCode) {
      throw new BadRequestException('Código de segurança inválido');
    }

    const updated = await this.prisma.childCheckIn.update({
      where: { id: checkInId },
      data: {
        checkOutAt: new Date(),
        checkedOutBy,
      },
      include: { child: true },
    });

    return {
      ...updated,
      message: `Check-out realizado para ${updated.child.fullName}`,
    };
  }

  async getActiveCheckIns(tenantId: string) {
    return this.prisma.childCheckIn.findMany({
      where: {
        checkOutAt: null,
        child: { tenantId },
      },
      include: {
        child: {
          select: {
            id: true,
            fullName: true,
            ageGroup: true,
            parentName: true,
            parentPhone: true,
            allergies: true,
            photoUrl: true,
          },
        },
      },
      orderBy: { checkInAt: 'desc' },
    });
  }

  async getCheckInHistory(tenantId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    return this.prisma.childCheckIn.findMany({
      where: {
        checkInAt: { gte: startOfDay, lte: endOfDay },
        child: { tenantId },
      },
      include: {
        child: {
          select: {
            id: true,
            fullName: true,
            ageGroup: true,
            parentName: true,
          },
        },
      },
      orderBy: { checkInAt: 'desc' },
    });
  }

  async getStats(tenantId: string) {
    const [totalChildren, activeCheckIns, todayCheckIns] = await Promise.all([
      this.prisma.child.count({ where: { tenantId, active: true } }),
      this.prisma.childCheckIn.count({
        where: { checkOutAt: null, child: { tenantId } },
      }),
      this.prisma.childCheckIn.count({
        where: {
          checkInAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          child: { tenantId },
        },
      }),
    ]);

    return { totalChildren, activeCheckIns, todayCheckIns };
  }

  private generateSecurityCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
