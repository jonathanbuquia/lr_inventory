import { execFileSync } from "child_process";
import fs from "fs";

const PH_TIMEZONE = "Asia/Manila";

function formatPhilippineDate(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get(
    "minute"
  )} ${get("dayPeriod").toUpperCase()}`;
}

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
    const isoTimestamp = execFileSync(
      "git",
      ["log", "-1", "--format=%cI"],
      {
        stdio: ["ignore", "pipe", "ignore"],
      }
    )
      .toString()
      .trim();

    return formatPhilippineDate(isoTimestamp);
  } catch {
    return null;
  }
}

function formatNow() {
  return formatPhilippineDate(new Date());
}

const timestamp =
  process.env.LR_LAST_UPDATED?.trim() ||
  readGitDate() ||
  readExistingDate() ||
  formatNow();

const content = `export const LAST_UPDATED = "${timestamp}";`;

fs.writeFileSync("src/lastUpdated.js", content);
