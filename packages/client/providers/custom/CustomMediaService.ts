import type { AxiosInstance } from 'axios'
import type { IMediaService } from '../../core/interfaces/IMediaService'
import type { MediaUploadOptions, MediaUploadResult } from '../../core/types'
import { ChatError, ChatErrorCode } from '../../core/errors/ChatError'

export class CustomMediaService implements IMediaService {
  private http: AxiosInstance

  constructor(http: AxiosInstance) {
    this.http = http
  }

  async uploadImage(file: File, options?: MediaUploadOptions): Promise<MediaUploadResult> {
    return this.upload(file, options)
  }

  async uploadVideo(file: File, options?: MediaUploadOptions): Promise<MediaUploadResult> {
    return this.upload(file, options)
  }

  async uploadAudio(file: File, options?: MediaUploadOptions): Promise<MediaUploadResult> {
    return this.upload(file, options)
  }

  async uploadFile(file: File, options?: MediaUploadOptions): Promise<MediaUploadResult> {
    return this.upload(file, options)
  }

  private async upload(file: File, options?: MediaUploadOptions): Promise<MediaUploadResult> {
    try {
      const formData = new FormData()
      formData.append('file', file)

      if (options?.thumbnailSize) {
        formData.append('thumbnailWidth', String(options.thumbnailSize.width))
        formData.append('thumbnailHeight', String(options.thumbnailSize.height))
      }

      const response = await this.http.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: options?.onProgress
          ? (progressEvent) => {
              const total = progressEvent.total ?? 0
              const loaded = progressEvent.loaded
              const percentage = total > 0 ? Math.round((loaded * 100) / total) : 0
              options.onProgress!({ loaded, total, percentage })
            }
          : undefined,
      })

      const data = response.data.data
      return {
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        thumbnailUrl: data.thumbnailUrl,
      }
    } catch (error) {
      throw new ChatError(ChatErrorCode.UPLOAD_FAILED, 'Failed to upload file', error)
    }
  }

  async generateThumbnail(
    file: File,
    size: { width: number; height: number }
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader()
        reader.onload = (e) => {
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              reject(new Error('Failed to get canvas context'))
              return
            }

            let { width, height } = size
            const ratio = img.width / img.height

            if (width / height > ratio) {
              width = height * ratio
            } else {
              height = width / ratio
            }

            canvas.width = width
            canvas.height = height
            ctx.drawImage(img, 0, 0, width, height)

            canvas.toBlob((blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('Failed to generate thumbnail'))
              }
            }, 'image/jpeg', 0.8)
          }
          img.onerror = () => reject(new Error('Failed to load image'))
          img.src = e.target?.result as string
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      } catch (error) {
        reject(error)
      }
    })
  }
}
