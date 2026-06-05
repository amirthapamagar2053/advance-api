import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private client: SupabaseClient;
  private bucket: string;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.get<string>('SUPABASE_URL')!,
      config.get<string>('SUPABASE_SERVICE_KEY')!,
    );
    this.bucket = config.get<string>('SUPABASE_BUCKET')!;
  }

  async uploadFile(buffer: Buffer, filename: string, mimetype: string): Promise<string> {
    const path = `receipts/${Date.now()}-${filename}`;
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, buffer, { contentType: mimetype, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);
    return data.publicUrl;
  }
}
