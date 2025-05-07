import { existsSync, mkdirSync } from "fs";
import { randomBytes } from "node:crypto";
import path from "path";

import type { ApiConfig } from "../config";
import { readableStreamToText } from "bun";
import type { Path } from "typescript";
import { spawn } from "node:child_process";

export function ensureAssetsDir(cfg: ApiConfig) {
  if (!existsSync(cfg.assetsRoot)) {
    mkdirSync(cfg.assetsRoot, { recursive: true });
  }
}

export function mediaTypeToExt(mediaType: string): string {
  const parts = mediaType.split("/");
  if (parts.length !== 2) {
    return ".bin";
  }
  return "." + parts[1];
}

export function getAssetDiskPath(cfg: ApiConfig, assetPath: string): string {
  return path.join(cfg.assetsRoot, assetPath);
}

export function getAssetURL(cfg: ApiConfig, assetPath: string): string {
  return `http://localhost:${cfg.port}/assets/${assetPath}`;
}

export function getS3URL(cfg: ApiConfig, filename: string): string {
  return `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${filename}`;
}

export function createFileName(mediaType: string): string {
  const ext = mediaTypeToExt(mediaType);
  const buffer = randomBytes(32);
  return `${buffer.toString("base64url")}${ext}`;
}

export async function getVideoAspectRatio(filePath: string): Promise<string> {
  const command = `ffprobe -v error -print_format json -show_streams ${filePath}`;
  const subProcess = Bun.spawn([...command.split(" ")], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const outputText = await readableStreamToText(subProcess.stdout);
  const errorText = await readableStreamToText(subProcess.stderr);

  const exitCode = await subProcess.exited;
  if (exitCode !== 0) {
    throw new Error(`ffprobe error:  ${errorText}`);
  }

  const mediaInfo = JSON.parse(outputText);
  if (!mediaInfo || mediaInfo.streams.length == 0) {
    throw new Error("No video stream found");
  }

  const { width, height } = mediaInfo.streams[0];

  const ratio = width / height;
  let aspectRatio = "other";
  if (Math.abs(ratio - 16 / 9) < 0.1) {
    aspectRatio = "landscape";
  } else if (Math.abs(ratio - 9 / 16) < 0.1) {
    aspectRatio = "portrait";
  }

  return aspectRatio;
}

export async function processVideoForFastStart(
  inputPath: string,
): Promise<string> {
  let outputFilePath = inputPath + ".processed";
  const fastStartProcess = Bun.spawn(
    [
      "ffmpeg",
      "-i",
      inputPath,
      "-movflags",
      "faststart",
      "-map_metadata",
      "0",
      "-codec",
      "copy",
      "-f",
      "mp4",
      outputFilePath,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const outputText = await readableStreamToText(fastStartProcess.stdout);
  const errorText = await readableStreamToText(fastStartProcess.stderr);

  const exitCode = await fastStartProcess.exited;
  if (exitCode !== 0) {
    console.error({ errorText });
    throw new Error(`ffmpeg error: ${errorText}`);
  }
  // console.log("processVideoForFastStart", { outputText });
  return outputFilePath;
}
