import * as core from '@actions/core'
import B2 from 'backblaze-b2';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import archiver from 'archiver';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { resolve } from 'path';
import { findFilesToUpload } from './search';
import { NoFileOptions } from "./constants";
import { getInputs } from "./input-helper";

async function run(): Promise<void> {

  try {

    const inputs = getInputs();

    const key = core.getInput('key');

    const id = core.getInput('id');

    const bucket = core.getInput('bucket');

    const searchResult = await findFilesToUpload(inputs.searchPath);

    if (searchResult.filesToUpload.length === 0) {

      // No files were found, different use cases warrant different types of behavior if nothing is found
      switch (inputs.ifNoFilesFound) {

        case NoFileOptions.warn: {

          core.warning(`No files were found with the provided path: ${inputs.searchPath}. No artifacts will be uploaded.`);

          return;
        }

        case NoFileOptions.error: {

          core.setFailed(`No files were found with the provided path: ${inputs.searchPath}. No artifacts will be uploaded.`);

          return;
        }

        case NoFileOptions.ignore: {

          core.info(`No files were found with the provided path: ${inputs.searchPath}. No artifacts will be uploaded.`);

          return;
        }
      }
    }

    core.info(`Root directory: ${searchResult.rootDirectory}`);

    core.info(`${searchResult.filesToUpload.length} files to upload`);

    core.startGroup('Files details');

    searchResult.filesToUpload.forEach(file => core.debug(file));

    core.endGroup();

    const tmp = process.env['RUNNER_TEMP'] ?? process.env['TEMP'] ?? process.env['TMP'] ?? process.env['TMPDIR'];

    const runId = `${process.env['GITHUB_REPOSITORY']!.replace('/', '-')}-${process.env['GITHUB_RUN_ID']}`;

    const artifactFileName = `${name}-${runId}`;

    const artifactFile = resolve(`${tmp}/${artifactFileName}`);

    const stream = fs.createWriteStream(artifactFile);

    const archive = archiver('tar');

    archive.pipe(stream);

    for (const path of searchResult.filesToUpload) {

      const name = path.split(searchResult.rootDirectory).pop();

      archive.file(path, { name: name! });
    }

    archive.on('progress', (progress) => {

      core.info(`Bundled ${progress.entries.processed} of ${progress.entries.total}`);

    });

    core.info(`Start of bundling`);

    await archive.finalize();

    core.info(`End of bundling`);

    core.info(`Start of upload`);

    axiosRetry(axios, { retries: 5, retryDelay: (retryCount) => retryCount * 1250, retryCondition: (error) => error.response?.status === 503 });

    const b2 = new B2({axios: axios, applicationKey: key, applicationKeyId: id});

    await b2.authorize();

    const bucketId = (await b2.getBucket({ bucketName: bucket })).data.buckets.pop().bucketId as string;

    const size = fs.statSync(artifactFile).size / (1024*1024);

    const chunkSize = 256;

    if (size > chunkSize) { // chunkSize or bigger

      const partsCount = Math.ceil(size / chunkSize);

      core.info(`Uploading ${partsCount} parts`);

      const largeFile = (await b2.startLargeFile({ bucketId: bucketId, fileName: artifactFileName })).data;

      const readStream = fs.createReadStream(artifactFile, {highWaterMark: chunkSize * 1024 * 1024 });

      let part = 0;

      const promises = new Array<Promise<void>>();

      const sh1Hashes = new Array<string>();

      readStream.on('data', (chunk: Buffer) => {

        part++;

        const partNumber = part;

        core.info(`Start of part ${partNumber}`);

        promises.push(new Promise<void>(resolve => {

          b2.getUploadPartUrl({ fileId: largeFile.fileId }).then(({data: partUrl}) => {

            b2.uploadPart({

              data: chunk,

              uploadUrl: partUrl.uploadUrl,

              uploadAuthToken: partUrl.authorizationToken,

              partNumber: partNumber

            }).then(() => {

              const hash = crypto.createHash('sha1');

              hash.update(chunk);

              sh1Hashes[partNumber - 1] = hash.digest('hex');

              core.info(`End of part ${partNumber}`);

              resolve();
            });
          });
        }));
      });

      await new Promise<void>((resolve, reject) => {

        readStream.on('end', () => {

          Promise.all(promises).then(() => {

            resolve();
          });
        });

        readStream.on('error', error => {

          reject(error);
        });
      });

      await b2.finishLargeFile({ fileId: largeFile.fileId, partSha1Array: sh1Hashes });

    } else { // smaller than chunkSize

      const buffer = fs.readFileSync(artifactFile);

      const uploadInfo = (await b2.getUploadUrl({ bucketId: bucketId })).data;

      await b2.uploadFile({

        data: buffer,

        fileName: artifactFileName,

        uploadUrl: uploadInfo.uploadUrl,

        uploadAuthToken: uploadInfo.authorizationToken

      });
    }

    core.info(`End of upload`);

  } catch (error) {

    if (error instanceof Error) core.setFailed(error.message);
  }
}

run()
