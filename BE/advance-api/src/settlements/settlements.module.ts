import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  imports: [ConfigModule],
  controllers: [SettlementsController],
  providers: [SettlementsService, SupabaseStorageService],
})
export class SettlementsModule {}
