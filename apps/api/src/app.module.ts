import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { KidsModule } from './kids/kids.module';
import { MembersModule } from './members/members.module';
import { MinistriesModule } from './ministries/ministries.module';
import { GroupsModule } from './groups/groups.module';
import { CommunicationModule } from './communication/communication.module';
import { DonationsModule } from './donations/donations.module';
import { SchoolModule } from './school/school.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    KidsModule,
    MembersModule,
    MinistriesModule,
    GroupsModule,
    CommunicationModule,
    DonationsModule,
    SchoolModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
export class AppModule {}
