import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto, SendMessageDto } from './dto';

@Injectable()
export class CommunicationService {
  constructor(private prisma: PrismaService) {}

  // ── Templates ──

  async findAllTemplates(tenantId: string, channel?: string) {
    return this.prisma.messageTemplate.findMany({
      where: {
        tenantId,
        active: true,
        ...(channel && { channel }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findTemplateById(id: string, tenantId: string) {
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!template) throw new NotFoundException('Template não encontrado');
    return template;
  }

  async createTemplate(tenantId: string, dto: CreateTemplateDto) {
    return this.prisma.messageTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        channel: dto.channel,
        content: dto.content,
        variables: dto.variables || [],
      },
    });
  }

  async updateTemplate(id: string, tenantId: string, dto: UpdateTemplateDto) {
    await this.findTemplateById(id, tenantId);

    const data: any = {};
    if (dto.name) data.name = dto.name;
    if (dto.channel) data.channel = dto.channel;
    if (dto.content) data.content = dto.content;
    if (dto.variables) data.variables = dto.variables;
    if (dto.active !== undefined) data.active = dto.active;

    return this.prisma.messageTemplate.update({ where: { id }, data });
  }

  async deleteTemplate(id: string, tenantId: string) {
    await this.findTemplateById(id, tenantId);
    await this.prisma.messageTemplate.update({ where: { id }, data: { active: false } });
    return { message: 'Template desativado' };
  }

  // ── Messages ──

  async sendMessage(tenantId: string, dto: SendMessageDto) {
    const messages: any[] = [];

    // Resolve recipients
    for (const recipientId of dto.recipientIds) {
      let to = '';

      if (dto.recipientType === 'visitor') {
        const visitor = await this.prisma.visitor.findFirst({
          where: { id: recipientId, tenantId },
        });
        if (!visitor) continue;
        to = dto.channel === 'email' ? (visitor.email || '') : visitor.phone;
      } else {
        const member = await this.prisma.member.findFirst({
          where: { id: recipientId, tenantId },
        });
        if (!member) continue;
        to = dto.channel === 'email' ? (member.email || '') : (member.phone || '');
      }

      if (!to) continue;

      // Resolve content
      let content = dto.content;
      if (dto.templateId) {
        const template = await this.findTemplateById(dto.templateId, tenantId);
        content = template.content;
      }

      // Create message record (queued for processing)
      const message = await this.prisma.message.create({
        data: {
          tenantId,
          visitorId: dto.recipientType === 'visitor' ? recipientId : null,
          templateId: dto.templateId || null,
          channel: dto.channel,
          to,
          content: content || {},
          status: 'QUEUED',
        },
      });

      messages.push(message);
    }

    // TODO: In production, dispatch to BullMQ queue for async processing
    // For now, we just create the records as QUEUED

    return {
      sent: messages.length,
      total: dto.recipientIds.length,
      messages: messages.map((m) => ({ id: m.id, to: m.to, status: m.status })),
    };
  }

  async getMessageHistory(tenantId: string, query?: { channel?: string; page?: number; limit?: number }) {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (query?.channel) where.channel = query.channel;

    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          template: { select: { name: true } },
        },
      }),
      this.prisma.message.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getStats(tenantId: string) {
    const [totalSent, totalQueued, totalFailed, totalTemplates] = await Promise.all([
      this.prisma.message.count({ where: { tenantId, status: 'SENT' } }),
      this.prisma.message.count({ where: { tenantId, status: 'QUEUED' } }),
      this.prisma.message.count({ where: { tenantId, status: 'FAILED' } }),
      this.prisma.messageTemplate.count({ where: { tenantId, active: true } }),
    ]);

    // Messages by channel
    const byChannel = await this.prisma.message.groupBy({
      by: ['channel'],
      where: { tenantId },
      _count: true,
    });

    return {
      totalSent,
      totalQueued,
      totalFailed,
      totalTemplates,
      byChannel: byChannel.map((c) => ({ channel: c.channel, count: c._count })),
    };
  }

  // ── Notifications ──

  async getNotifications(tenantId: string, userId: string) {
    return this.prisma.notification.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markNotificationRead(id: string, tenantId: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async getUnreadCount(tenantId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: { tenantId, userId, readAt: null },
    });
    return { unread: count };
  }
}
