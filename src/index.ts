import { config } from './utils/config';

import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import { Vtf, DataBuffer } from 'vtf-js';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

function calculateHash(filePath: string, algorithm: string) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (error) => reject(error));
  });
}

async function downloadFile(path: string, init: boolean = false) {
    let filename = path.split('/').reverse()[0];
    await axios({
        method: "get",
        url: `https://wavespray.dathost.net/fastdl/teamfortress2/679d9656b8573d37aa848d60${path}`,
        responseType: "stream"
    }).then(function (response) {
        if(init)
            response.data.pipe(fs.createWriteStream(`/temp/initial/${filename}`));
        else
            response.data.pipe(fs.createWriteStream(`/temp/downloaded/${filename}`));
    });
}

async function compareHash(file: string) {
    let initial = await calculateHash(`/temp/initial/${file}`, 'sha256');
    let downloaded = await calculateHash(`/temp/downloaded/${file}`, 'sha256');
    return initial !== downloaded;
}

async function saveFile(file: string, Date: Date) {
    const exportDir = `./data/${Date.toISOString()}`;
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    await fs.copyFileSync(`/temp/downloaded/${file}`, `${exportDir}/${file}`);
    if(file.split('.').reverse()[0] === "vtf") {
        createMp4FromVtf(`${exportDir}/${file}`, `${exportDir}/view.mp4`, { tempDir: `${exportDir}/frames`});
        // Re-initialize
        await downloadFile(`/materials/${file}`, true);
        return;
    }
    // Re-initialize
    await downloadFile(`/maps/${file}`, true);
}

async function createMp4FromVtf(
  inputVtf: string,
  outputMp4: any,
  { fps = 30, tempDir = 'frames' } = {}
) {
  // Create frames directory
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Process VTF file
    const buffer = fs.readFileSync(inputVtf);
    const arrayBuffer = new DataBuffer(buffer).buffer;
    const image = Vtf.decode(arrayBuffer);

    const frames = image.data.frameCount();

    // Extract frames
    await Promise.all(
      Array.from({ length: frames }).map(async (_, i) => {
        const framePath = path.join(tempDir, `frame_${i.toString().padStart(5, '0')}.png`);
        const frameData = image.data.getImage(0, i, 0, 0);

        const png_image = Buffer.from(frameData.convert(Uint8Array).data);

        const width = frameData.width;
        const height = frameData.height;
        
        await sharp(png_image, {
          raw: {
            width,
            height,
            channels: 4
          }
        })
        .png()
        .toFile(framePath);
      })
    );

    // Configure FFmpeg
    const command = ffmpeg()
      .input(path.join(tempDir, 'frame_%05d.png'))
      .inputFPS(fps)
      .output(outputMp4)
      .videoCodec('libx264')
      .outputOptions([
        '-preset fast',
        '-crf 23',
        '-pix_fmt yuv420p',
        '-movflags +faststart'
      ]);

    // Add audio if provided
    /*if (audioPath) {
      command
        .input(audioPath)
        .audioCodec('aac')
        .audioBitrate('128k')
        .outputOptions('-shortest'); // Match video duration to audio
    }*/

    // Execute encoding
    await new Promise((resolve, reject) => {
      command
        .on('start', (cmd: any) => console.log(`Executing: ${cmd}`))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

  } catch(err) {
    console.error(err);
  }
}

function alertDiscord() {

}

function alertPagerDuty() {

}

async function Main() {
    // Setup
    await fs.mkdirSync("/temp/initial", { recursive: true });
    await fs.mkdirSync("/temp/downloaded", { recursive: true });

    // Downloading initial files
    await downloadFile("/maps/view.bsp", true);
    await downloadFile("/materials/view.vtf", true);
    await downloadFile("/maps/ask.bsp", true);
    await downloadFile("/maps/askask.bsp", true);

    const fileList = await fs.readdirSync("/temp/initial");

    setInterval(async () => {
        await downloadFile("/maps/view.bsp");
        await downloadFile("/materials/view.vtf");
        await downloadFile("/maps/ask.bsp");
        await downloadFile("/maps/askask.bsp");

        console.log(fileList);

        const curDate = new Date;
        fileList.forEach(async file => {
            if(await compareHash(file)) {
                console.log(`${file} checksum matches, skipping...`);
            } else {
                console.log(`${file} checksum changed, sending alert!`);
                saveFile(file, curDate);

                // Send Alert
            }
        });

        console.log("Restarting in 10 seconds");
    }, 10000);
}

Main();