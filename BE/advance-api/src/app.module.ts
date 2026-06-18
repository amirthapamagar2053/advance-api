import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AdvancesModule } from './advances/advances.module';
import { SettlementsModule } from './settlements/settlements.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    UsersModule,
    AuthModule,
    AdvancesModule,
    SettlementsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
