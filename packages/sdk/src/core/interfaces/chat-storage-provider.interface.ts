import { Readable } from 'stream';

export interface ChatUploadOptions {
  fileName: string;
  mimeType: string;
  folder?: string;
  tenantId: string;
}

export interface ChatUploadResult {
  fileUrl: string;
  thumbnailUrl?: string;
  fileSize: number;
  mimeType: string;
}

export interface IChatStorageProvider {
  upload(file: Buffer | Readable, options: ChatUploadOptions): Promise<ChatUploadResult>;
  delete(fileUrl: string): Promise<void>;
  getSignedUrl?(fileUrl: string, expiresIn?: number): Promise<string>;
}
