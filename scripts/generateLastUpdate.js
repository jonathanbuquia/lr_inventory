import { execSync } from "child_process";
import fs from "fs";

function readExistingDate() {
  try {
    const existing = fs.readFileSync("src/lastUpdated.js", "utf8");
    const match = existing.match(/LAST_UPDATED\s*=\s*"([^"]+)"/);
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

function readGitDate() {
  try {
    return execSync('git log -1 --date=format-local:"%Y-%m-%d %I:%M %p" --format=%cd', {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function formatNow() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours24 = now.getHours();
  const hours12 = String(hours24 % 12 || 12).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const meridiem = hours24 >= 12 ? "PM" : "AM";

  return `${year}-${month}-${day} ${hours12}:${minutes} ${meridiem}`;
}

const timestamp =
  process.env.LR_LAST_UPDATED?.trim() ||
  readGitDate() ||
  readExistingDate() ||
  formatNow();

const content = `export const LAST_UPDATED = "${timestamp}";`;

fs.writeFileSync("src/lastUpdated.js", content);
