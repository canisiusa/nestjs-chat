export interface MediaUploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface MediaUploadResult {
  fileUrl: string
  fileName: string
  fileSize: number
  mimeType: string
  thumbnailUrl?: string
}

export interface MediaUploadOptions {
  onProgress?: (progress: MediaUploadProgress) => void
  thumbnailSize?: { width: number; height: number }
}
