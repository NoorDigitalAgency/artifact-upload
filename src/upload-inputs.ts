import {NoFileOptions} from './constants'

export interface UploadInputs {
  /**
   * The name of the artifact that will be uploaded
   */
  artifactName: string

  /**
   * The search path used to describe what to upload as part of the artifact
   */
  searchPath: string

  /**
   * The desired behavior if no files are found with the provided search path
   */
  ifNoFilesFound: NoFileOptions

  /**
   * Duration after which artifact will expire in days
   */
  retentionDays: number

  /**
   * Backblaze Application Key
   */
  backblazeKey: string

  /**
   * Backblaze Application Key ID
   */
  backblazeKeyId: string

  /**
   * Backblaze Bucket Name
   */
  backblazeBucketName: string

  /**
   * Upload chunk size
   */
  chunkSize: number,

  /**
   * Memory limit
   */
  memoryLimit: number,

  /**
   * Compression level
   */
  compressionLevel: number
}