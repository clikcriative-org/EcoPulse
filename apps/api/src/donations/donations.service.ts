import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDonationDto, CreateCampaignDto, UpdateCampaignDto } from './dto';

@Injectable()
export class DonationsService {
  constructor(private prisma: PrismaService) {}

  // ── Donations ──

  async create(tenantId: string, dto: CreateDonationDto) {
    const donation = await this.prisma.donation.create({
      data: {
        tenantId,
        memberId: dto.memberId,
        campaignId: dto.campaignId,
        type: dto.type as any,
        amountCents: dto.amountCents,
        paymentMethod: dto.paymentMethod as any,
        paymentStatus: 'CONFIRMED',
        donorName: dto.donorName,
        donorEmail: dto.donorEmail,
        notes: dto.notes,
        isRecurring: dto.isRecurring || false,
      },
    });

    // Update campaign raised amount
    if (dto.campaignId) {
      await this.prisma.campaign.update({
        where: { id: dto.campaignId },
        data: { raisedCents: { increment: dto.amountCents } },
      });
    }

    return donation;
  }

  async findAll(tenantId: string, query?: { type?: string; page?: number; limit?: number; month?: number; year?: number }) {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (query?.type) where.type = query.type;

    if (query?.month && query?.year) {
      const start = new Date(query.year, query.month - 1, 1);
      const end = new Date(query.year, query.month, 0, 23, 59, 59);
      where.donatedAt = { gte: start, lte: end };
    }

    const [data, total] = await Promise.all([
      this.prisma.donation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { donatedAt: 'desc' },
        include: {
          member: { select: { id: true, fullName: true } },
          campaign: { select: { id: true, name: true } },
        },
      }),
      this.prisma.donation.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getStats(tenantId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [thisMonth, lastMonth, tithesThisMonth, offeringsThisMonth, totalDonors] = await Promise.all([
      this.prisma.donation.aggregate({
        where: { tenantId, paymentStatus: 'CONFIRMED', donatedAt: { gte: startOfMonth } },
        _sum: { amountCents: true },
        _count: true,
      }),
      this.prisma.donation.aggregate({
        where: { tenantId, paymentStatus: 'CONFIRMED', donatedAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        _sum: { amountCents: true },
      }),
      this.prisma.donation.aggregate({
        where: { tenantId, paymentStatus: 'CONFIRMED', type: 'TITHE', donatedAt: { gte: startOfMonth } },
        _sum: { amountCents: true },
      }),
      this.prisma.donation.aggregate({
        where: { tenantId, paymentStatus: 'CONFIRMED', type: 'OFFERING', donatedAt: { gte: startOfMonth } },
        _sum: { amountCents: true },
      }),
      this.prisma.donation.groupBy({
        by: ['memberId'],
        where: { tenantId, memberId: { not: null }, donatedAt: { gte: startOfMonth } },
      }),
    ]);

    const thisMonthTotal = thisMonth._sum.amountCents || 0;
    const lastMonthTotal = lastMonth._sum.amountCents || 0;
    const growth = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100).toFixed(1) : '0';

    return {
      thisMonthTotal,
      lastMonthTotal,
      growth: parseFloat(growth as string),
      tithesThisMonth: tithesThisMonth._sum.amountCents || 0,
      offeringsThisMonth: offeringsThisMonth._sum.amountCents || 0,
      donationsCount: thisMonth._count,
      uniqueDonors: totalDonors.length,
    };
  }

  // ── Campaigns ──

  async findAllCampaigns(tenantId: string) {
    return this.prisma.campaign.findMany({
      where: { tenantId, active: true },
      include: { _count: { select: { donations: true } } },
      orderBy: { startAt: 'desc' },
    });
  }

  async createCampaign(tenantId: string, dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        goalCents: dto.goalCents,
        startAt: new Date(dto.startAt),
        endAt: dto.endAt ? new Date(dto.endAt) : null,
      },
    });
  }

  async updateCampaign(id: string, tenantId: string, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, tenantId } });
    if (!campaign) throw new NotFoundException('Campanha não encontrada');

    const data: any = {};
    if (dto.name) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.goalCents) data.goalCents = dto.goalCents;
    if (dto.startAt) data.startAt = new Date(dto.startAt);
    if (dto.endAt) data.endAt = new Date(dto.endAt);
    if (dto.active !== undefined) data.active = dto.active;

    return this.prisma.campaign.update({ where: { id }, data });
  }
}
