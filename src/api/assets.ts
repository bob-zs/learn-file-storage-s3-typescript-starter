import { existsSync, mkdirSync } from "fs";
import { randomBytes } from "node:crypto";
import path from "path";

import type { ApiConfig } from "../config";

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
