import { Module } from '@nestjs/common';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  controllers: [SettlementsController],
  providers: [SettlementsService, SupabaseStorageService],
})
export class SettlementsModule {}
