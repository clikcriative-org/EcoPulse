import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create plans
  const startPlan = await prisma.plan.upsert({
    where: { slug: 'start' },
    update: {},
    create: {
      name: 'RNO 360 | START',
      slug: 'start',
      priceCents: 9900,
      maxMembers: 300,
      maxUsers: 3,
      maxMinistries: 5,
      features: JSON.stringify([
        'Gestão central',
        'Cadastro de membros e famílias',
        'Gestão de eventos e grupos',
        'Check-in Kids básico',
        'Doações via Pix e cartão',
        'Relatórios essenciais',
      ]),
    },
  });

  const advancePlan = await prisma.plan.upsert({
    where: { slug: 'advance' },
    update: {},
    create: {
      name: 'RNO 360 | ADVANCE',
      slug: 'advance',
      priceCents: 19900,
      maxMembers: 1000,
      maxUsers: 10,
      maxMinistries: 20,
      features: JSON.stringify([
        'Tudo do START',
        'Gestão completa de células e líderes',
        'Comunicação WhatsApp e e-mail',
        'Ensino & discipulado com trilhas',
        'Relatórios avançados',
        'Integração Web',
        'Automações de leads',
      ]),
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: { slug: 'pro' },
    update: {},
    create: {
      name: 'RNO 360 | PRO',
      slug: 'pro',
      priceCents: 39900,
      maxMembers: 10000,
      maxUsers: 50,
      maxMinistries: 100,
      features: JSON.stringify([
        'Tudo do ADVANCE',
        'App personalizado',
        'Múltiplas sedes',
        'Chatbot com IA',
        'Painéis executivos',
        'Suporte prioritário',
      ]),
    },
  });

  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'igreja-demo' },
    update: {},
    create: {
      name: 'Igreja Demo',
      slug: 'igreja-demo',
      planId: advancePlan.id,
      primaryColor: '#10b981',
    },
  });

  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@ecopulse.com.br' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@ecopulse.com.br',
      passwordHash,
      name: 'Administrador',
      role: 'ADMIN',
      phone: '+5562982839761',
    },
  });

  console.log('✅ Seed completed successfully');
  console.log(`   Plans: ${startPlan.name}, ${advancePlan.name}, ${proPlan.name}`);
  console.log(`   Tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`   Admin: admin@ecopulse.com.br / admin123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
