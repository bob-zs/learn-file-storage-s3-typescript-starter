import { type ApiConfig } from "../config";
import { reset } from "../db/db";
import { UserForbiddenError } from "./errors";
import { respondWithJSON } from "./json";
import { readdirSync, rmSync } from "fs";

export async function handlerReset(cfg: ApiConfig, _: Request) {
  if (cfg.platform !== "dev") {
    throw new UserForbiddenError("Reset is only allowed in dev environment.");
  }

  reset(cfg.db);

  readdirSync(cfg.assetsRoot).forEach((filePath) =>
    rmSync(`${cfg.assetsRoot}/${filePath}`),
  );

  return respondWithJSON(200, { message: "Database reset to initial state" });
}
