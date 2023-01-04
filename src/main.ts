import * as core from '@actions/core'
import B2 from 'backblaze-b2';
import axios from 'axios';
import archiver from 'archiver';
import * as fs from 'fs';
import * as crypto from 'crypto';

async function run(): Promise<void> {

  const inputRegex = /^\s*\/*(?<name>.*?)\/*\s*$/gm;

  const name = core.getInput('name', {required: false}) || 'artifact';

  const paths = [...new Set([...(core.getInput('path', {required: false}) || `
  main.js
  files/`).matchAll(inputRegex)].map(match => match.groups?.name))].filter(match => (match ?? '') !== '');

  const tmp = process.env['RUNNER_TEMP'] ?? process.env['TEMP'] ?? process.env['TMP'] ?? process.env['TMPDIR'];

  const runId = process.env['GITHUB_RUN_ID'] ?? 'xyz';

  const dirname = process.env['GITHUB_WORKSPACE'] ?? __dirname;

  const artifactFile = tmp + `/${runId}-artifacts-upload`;

  const stream = fs.createWriteStream(artifactFile);

  const archive = archiver('tar', {gzip: true, gzipOptions: {level: 9}});

  archive.pipe(stream);

  for (const path of paths) {

    const fullPath = `${dirname}/${path}`;

    const stats = fs.statSync(fullPath);

    if (stats.isFile()) {

      archive.file(fullPath, { name: path! });

    } else if (stats.isDirectory()) {

      archive.directory(fullPath, path!);

    } else {

      throw new Error(`${fullPath} is neither a file nor a directory.`);
    }
  }

  archive.on('progress', (progress) => {

    core.debug(`Total: ${progress.entries.total}, Processed: ${progress.entries.processed}`);

  });

  core.debug(`Start of compression`);

  await archive.finalize();

  core.debug(`End of compression`);

  const b2 = new B2({axios: axios, applicationKey: 'K003biq6LWSel4z+ku9C/zO5eBIrulI', applicationKeyId: '003b705a4cfb3c5000000001b'});

  await b2.authorize();

  const id = (await b2.getBucket({ bucketName: 'github-artifacts' })).data.buckets.pop().bucketId as string;

  const size = fs.statSync(artifactFile).size / (1024*1024);

  if (size > 500) { // 500MB or bigger

    const largeFile = (await b2.startLargeFile({ bucketId: id, fileName: artifactFile })).data;

    const readStream = fs.createReadStream(artifactFile, {highWaterMark: 500 * 1024 * 1024 });

    let part = 0;

    const promises = new Array<Promise<void>>();

    const sh1Hashes = new Array<string>();

    readStream.on('data', (chunk: Buffer) => {

      part++;

      const partNumber = part;

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

    console.log();

    await b2.finishLargeFile({ fileId: largeFile.fileId, partSha1Array: sh1Hashes });

  } else { // smaller than 500MB

  }

  //const data3 = (await b2.startLargeFile({ bucketId: id, fileName: "xxx" })).data;

  const buffer = fs.readFileSync(artifactFile);

  const data1 = (await b2.getUploadUrl({ bucketId: id })).data;

  const data2 = (await b2.uploadFile({

    data: buffer,

    fileName: "artifacts-upload",

    uploadUrl: data1.uploadUrl,

    uploadAuthToken: data1.authorizationToken

  })).data;

  try {
    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
