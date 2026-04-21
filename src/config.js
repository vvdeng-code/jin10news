import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ override: true });

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

function listFromEnv(name) {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const jin10SiteUrl = process.env.JIN10_SITE_URL ?? "https://www.jin10.com/";
const jin10FlashUrl =
  process.env.JIN10_FLASH_URL ?? "https://flash-api.jin10.com/get_flash_list?channel=-8200&vip=1";

const required = [
  "GMAIL_USER",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "EMAIL_TO",
  "ANTHROPIC_API_KEY"
];
const missing = required.filter((key) => !process.env[key]);

export const config = {
  gmailUser: process.env.GMAIL_USER ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? "",
  emailFrom: process.env.EMAIL_FROM ?? process.env.GMAIL_USER ?? "",
  emailTo: listFromEnv("EMAIL_TO"),
  emailSubjectPrefix: process.env.EMAIL_SUBJECT_PREFIX ?? "",
  pollIntervalSeconds: intFromEnv("POLL_INTERVAL_SECONDS", 60),
  jin10RequestTimeoutMs: intFromEnv("JIN10_REQUEST_TIMEOUT_MS", 20000),
  jin10RequestRetries: intFromEnv("JIN10_REQUEST_RETRIES", 2),
  emailSendTimeoutMs: intFromEnv("EMAIL_SEND_TIMEOUT_MS", 30000),
  emailSendRetries: intFromEnv("EMAIL_SEND_RETRIES", 2),
  quietHoursStart: intFromEnv("QUIET_HOURS_START", 0),
  quietHoursEnd: intFromEnv("QUIET_HOURS_END", 9),
  morningDigestMaxTopics: intFromEnv("MORNING_DIGEST_MAX_TOPICS", 3),
  topicStateWindowHours: intFromEnv("TOPIC_STATE_WINDOW_HOURS", 168),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  storePath: path.resolve(process.env.STORE_PATH ?? "./data/store.json"),
  jin10SiteUrl,
  sources: [
    {
      name: "金十数据",
      type: "jin10-flash",
      url: jin10FlashUrl,
      siteUrl: jin10SiteUrl
    }
  ],
  missingRequiredEnv: missing
};
