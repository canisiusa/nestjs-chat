import type { MediaUploadOptions, MediaUploadResult } from '../types'

export interface IMediaService {
  uploadImage(file: File, options?: MediaUploadOptions): Promise<MediaUploadResult>
  uploadVideo(file: File, options?: MediaUploadOptions): Promise<MediaUploadResult>
  uploadAudio(file: File, options?: MediaUploadOptions): Promise<MediaUploadResult>
  uploadFile(file: File, options?: MediaUploadOptions): Promise<MediaUploadResult>
  generateThumbnail(file: File, size: { width: number; height: number }): Promise<Blob>
}
