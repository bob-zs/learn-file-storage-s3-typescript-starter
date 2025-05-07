import { getBearerToken, validateJWT } from "../auth";
import {
  getAssetDiskPath,
  createFileName,
  getS3URL,
  getVideoAspectRatio,
  processVideoForFastStart,
} from "./assets";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import { uploadVideoToS3 } from "../s3";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("no video id provided");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }
  if (video.userID != userID) {
    throw new UserForbiddenError("Not authorized to upload this video");
  }

  const formData = await req.formData();
  const file = formData.get("video");
  if (!(file instanceof File)) {
    throw new BadRequestError("Video file missing");
  }
  const MAX_UPLOAD_SIZE = 1 << 30;
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError(
      "Video file exceeds maximum allowed size of 1 GB",
    );
  }
  if (file.type !== "video/mp4") {
    throw new BadRequestError("Invalid file type. Only supporting mp4");
  }

  const filename = createFileName(file.type);
  const assetDiskPath = getAssetDiskPath(cfg, filename);
  await Bun.write(assetDiskPath, file);

  const processedPath = await processVideoForFastStart(assetDiskPath);
  const proccessedFileExists = await Bun.file(processedPath).exists();
  if (!proccessedFileExists) {
    throw new Error("Processed video file not found.");
  }

  const aspectRatio = await getVideoAspectRatio(processedPath);
  const fileS3Key = `${aspectRatio}/${filename}`;

  const s3FileExists = await uploadVideoToS3(
    cfg,
    fileS3Key,
    processedPath,
    file.type,
  );
  if (!s3FileExists) {
    throw new NotFoundError("file not stored in s3.");
  }

  video.videoURL = getS3URL(cfg, fileS3Key);
  updateVideo(cfg.db, video);

  await Bun.file(assetDiskPath).delete();
  const isDiskFileExist = await Bun.file(assetDiskPath).exists();
  if (isDiskFileExist) {
    throw new Error("Unable to delete temporary video file from disk.");
  }

  await Bun.file(processedPath).delete();
  const isProcessedFileExist = await Bun.file(processedPath).exists();
  if (isProcessedFileExist) {
    throw new Error(
      "Unable to delete temporary processed video file from disk.",
    );
  }

  return respondWithJSON(200, null);
}
