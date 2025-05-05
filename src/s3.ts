import type { ApiConfig } from "./config";

export async function uploadVideoToS3(
  cfg: ApiConfig,
  key: string,
  filePath: string,
  contentType: string,
) {
  const s3file = cfg.s3Client.file(key, { bucket: cfg.s3Bucket });
  const videoFile = Bun.file(filePath);
  await s3file.write(videoFile, { type: contentType });
  return s3file.exists();
}
