import * as core from '@actions/core'
import B2 from 'backblaze-b2';
import axios from 'axios';
import archiver from 'archiver';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { findFilesToUpload } from './search';
import tar from 'tar';
import {resolve} from 'path';

async function run(): Promise<void> {

  try {

    const name = core.getInput('name', {required: false}) || 'artifact-upload-file';

    const path = core.getInput('path', {required: false}) || `
    lib/main.js
    lib/files`;

    const searchResult = await findFilesToUpload(path);

    if (searchResult.filesToUpload.length === 0) throw new Error('No files to upload');

    core.info(`Root directory: ${searchResult.rootDirectory}`);

    core.info(`${searchResult.filesToUpload.length} files to upload`);

    core.startGroup('Files details');

    searchResult.filesToUpload.forEach(file => core.debug(file));

    core.endGroup();

    const tmp = process.env['RUNNER_TEMP'] ?? process.env['TEMP'] ?? process.env['TMP'] ?? process.env['TMPDIR'];

    const runId = process.env['GITHUB_RUN_ID'] ?? Math.floor(Math.random() * (999999 - 100000) + 100000);

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

    const b2 = new B2({axios: axios, retry: {retries: 5}, applicationKey: 'K003biq6LWSel4z+ku9C/zO5eBIrulI', applicationKeyId: '003b705a4cfb3c5000000001b'});

    await b2.authorize();

    const id = (await b2.getBucket({ bucketName: 'github-artifacts' })).data.buckets.pop().bucketId as string;

    const size = fs.statSync(artifactFile).size / (1024*1024);

    const chunkSize = 256;

    if (size > chunkSize) { // chunkSize or bigger

      const partsCount = Math.ceil(size / chunkSize);

      core.info(`Uploading ${partsCount} parts`);

      const largeFile = (await b2.startLargeFile({ bucketId: id, fileName: artifactFileName })).data;

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

      const uploadInfo = (await b2.getUploadUrl({ bucketId: id })).data;

      await b2.uploadFile({

        data: buffer,

        fileName: artifactFileName,

        uploadUrl: uploadInfo.uploadUrl,

        uploadAuthToken: uploadInfo.authorizationToken

      });
    }

    core.info(`End of upload`);

    const file = (await b2.listFileNames({ startFileName: artifactFileName, maxFileCount: 10000, prefix: '', delimiter: '/', bucketId: id })).data.files.pop();

    console.log(file);

    const stream1 = (await b2.downloadFileById({ fileId: file.fileId as string, responseType: 'stream' })).data;

    const path1 = `${artifactFile}.down`;

    console.log(path1);

    const writer = fs.createWriteStream(path1);

    await new Promise((resolve, reject) => {

      stream1.pipe(writer);

      let error = null as unknown;

      writer.on('error', err => {

        error = err;

        writer.close();

        reject(err);

      });

      writer.on('close', () => {

        if (!error) {

          resolve(true);
        }
      });
    });

    const path2 = resolve(`${path1}-extract/`);

    fs.mkdirSync(path2);

    await new Promise((resolve, reject) => {

      fs.createReadStream(path1)

        .on('error', reject)

        .on('end', resolve)

        .pipe(tar.extract({

          cwd: path2,

          strip: 0
        }));
    });

  } catch (error) {

    if (error instanceof Error) core.setFailed(error.message);
  }
}

run()
