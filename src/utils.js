import crypto from "node:crypto";

export function decodeHtmlText(input) {
  return (input ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n")
    .replace(/<\/li>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

export function cleanText(input, maxLen = 220) {
  const text = decodeHtmlText(input)
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

export function cleanMultilineText(input, maxLen = 4000) {
  const text = decodeHtmlText(input)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

export function preserveSourceMultilineText(input, maxLen = 8000) {
  const text = decodeHtmlText(input)
    .replace(/\r\n?/g, "\n")
    .trim();

  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

export function makeHash(input) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

export function normalizeForCompare(input) {
  return (input ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function jaccardSimilarity(a, b) {
  const setA = new Set(normalizeForCompare(a).split(" ").filter(Boolean));
  const setB = new Set(normalizeForCompare(b).split(" ").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter((token) => setB.has(token)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

export function toShanghaiISOString(date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })
    .format(date)
    .replace(" ", "T");
}

export function formatShanghaiDateTime(date) {
  return toShanghaiISOString(date).replace("T", " ");
}

export function getShanghaiParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);

  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function getShanghaiDateKey(date = new Date()) {
  const parts = getShanghaiParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getShanghaiHour(date = new Date()) {
  return Number.parseInt(getShanghaiParts(date).hour, 10);
}

export function parseTimeMs(value, fallback = Date.now()) {
  if (!value) return fallback;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : fallback;
}
