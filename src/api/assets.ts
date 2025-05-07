import { existsSync, mkdirSync } from "fs";
import { randomBytes } from "node:crypto";
import path from "path";

import type { ApiConfig } from "../config";
import { readableStreamToText } from "bun";

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
  const subProcess = Bun.spawn(
    [
      "ffprobe",
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      filePath,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );

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

  const { width, height } = mediaInfo.stream[0];

  const ratio = width / height;
  let aspectRatio = "other";
  if (Math.abs(ratio - 16 / 9) < 0.1) {
    aspectRatio = "landscape";
  } else if (Math.abs(ratio - 9 / 16) < 0.1) {
    aspectRatio = "portrait";
  }

  return aspectRatio;
}
