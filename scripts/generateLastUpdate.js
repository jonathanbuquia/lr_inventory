import { execSync } from "child_process";
import fs from "fs";

const date = execSync("git log -1 --format=%cd --date=short")
  .toString()
  .trim();

const content = `export const LAST_UPDATED = "${date}";`;

fs.writeFileSync("src/lastUpdated.js", content);