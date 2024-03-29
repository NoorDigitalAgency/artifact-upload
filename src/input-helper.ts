import * as core from '@actions/core'
import {Inputs, NoFileOptions} from './constants'
import {UploadInputs} from './upload-inputs'

/**
 * Helper to get all the inputs for the action
 */
export function getInputs(): UploadInputs {
  const name = core.getInput(Inputs.Name)
  const path = core.getInput(Inputs.Path, {required: true})
  const key = core.getInput(Inputs.Key, {required: true})
  const id = core.getInput(Inputs.Id, {required: true})
  const bucket = core.getInput(Inputs.Bucket)

  const ifNoFilesFound = core.getInput(Inputs.IfNoFilesFound) as NoFileOptions
  const noFileBehavior: NoFileOptions = NoFileOptions[ifNoFilesFound]

  if (!noFileBehavior) {
    core.setFailed(
      `Unrecognized ${
        Inputs.IfNoFilesFound
      } input. Provided: ${ifNoFilesFound}. Available options: ${Object.keys(
        NoFileOptions
      )}`
    )
  }

  const inputs = {
    artifactName: name,
    searchPath: path,
    ifNoFilesFound: noFileBehavior,
    backblazeKey: key,
    backblazeKeyId: id,
    backblazeBucketName: bucket,
    compressionLevel: 0
  } as UploadInputs

  const retentionDaysStr = core.getInput(Inputs.RetentionDays)
  if (retentionDaysStr) {
    inputs.retentionDays = parseInt(retentionDaysStr)
    if (isNaN(inputs.retentionDays)) {
      core.setFailed('Invalid retention-days')
    }
  }

  const chunkSizeStr = core.getInput(Inputs.ChunkSize)
  if (chunkSizeStr) {
    inputs.chunkSize = parseInt(chunkSizeStr)
    if (isNaN(inputs.chunkSize)) {
      core.setFailed('Invalid chunk-size')
    }
  }

  const memoryLimitStr = core.getInput(Inputs.MemoryLimit)
  if (memoryLimitStr) {
    inputs.memoryLimit = parseInt(memoryLimitStr)
    if (isNaN(inputs.memoryLimit)) {
      core.setFailed('Invalid memory-limit')
    }
  }

  const compressionLevelStr = core.getInput(Inputs.CompressionLevel);
  if (compressionLevelStr) {
    inputs.compressionLevel = parseInt(compressionLevelStr);
    if (isNaN(inputs.compressionLevel)) {
      core.setFailed('Invalid compression-level')
    }
  }

  return inputs
}