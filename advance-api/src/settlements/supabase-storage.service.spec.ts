import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseStorageService } from './supabase-storage.service';
import { ConfigService } from '@nestjs/config';

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockFrom = jest.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    storage: {
      from: (...args: any[]) => mockFrom(...args),
    },
  })),
}));

describe('SupabaseStorageService', () => {
  let service: SupabaseStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseStorageService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'SUPABASE_URL') return 'https://example.supabase.co';
              if (key === 'SUPABASE_SERVICE_KEY') return 'service-key';
              if (key === 'SUPABASE_BUCKET') return 'receipts';
            },
          },
        },
      ],
    }).compile();
    service = module.get<SupabaseStorageService>(SupabaseStorageService);
  });

  afterEach(() => jest.clearAllMocks());

  it('uploads file buffer and returns the public URL', async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/receipt.jpg' } });
    const url = await service.uploadFile(Buffer.from('data'), 'receipt.jpg', 'image/jpeg');
    expect(url).toBe('https://example.com/receipt.jpg');
    expect(mockUpload).toHaveBeenCalled();
  });

  it('throws an error when Supabase storage upload fails', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'bucket not found' } });
    await expect(service.uploadFile(Buffer.from('data'), 'f.jpg', 'image/jpeg'))
      .rejects.toThrow('Storage upload failed: bucket not found');
  });
});
