import { config } from "./config.js";
import { createEmailSender } from "./email.js";
import { processIncomingItems } from "./engine.js";
import { pullAllSources } from "./sources.js";
import { FileStore } from "./store.js";

function messageLogLine(message) {
  if (typeof message === "string") {
    return message.split("\n")[0];
  }

  return message.subject ?? message.text?.split("\n")[0] ?? "email message";
}

async function main() {
  if (config.missingRequiredEnv.length > 0) {
    console.error(
      `Missing required env: ${config.missingRequiredEnv.join(", ")}. Copy .env.example to .env first.`
    );
    process.exit(1);
  }

  const store = new FileStore(config.storePath);
  await store.init();

  const sendEmail = createEmailSender(config);
  const sendFn = async (message) => {
    await sendEmail(message);
    console.log(`[sent] ${messageLogLine(message)}`);
  };

  async function runPollingCycle() {
    if (!config.sources.length) {
      console.warn("No source feeds configured. Set JIN10_FLASH_URL.");
      return;
    }

    const items = await pullAllSources(config.sources);
    const stats = await processIncomingItems(items, store, sendFn);
    console.log(
      `[poll] fetched=${stats.total} matched=${stats.matched} sentRealtime=${stats.sentRealtime} queuedDigest=${stats.queuedDigest} sentDigest=${stats.sentDigest} digestEvents=${stats.digestEvents} alreadySent=${stats.alreadySent} skippedSameState=${stats.skippedSameState} failedSends=${stats.failedSends}`
    );
  }

  console.log("jin10 news started.");
  console.log(`Delivery channel: Gmail OAuth2 -> ${config.emailTo.join(", ")}`);
  console.log(`Polling every ${config.pollIntervalSeconds}s`);
  console.log(`Quiet hours: ${config.quietHoursStart}:00-${config.quietHoursEnd}:00 (Asia/Shanghai)`);

  await runPollingCycle();

  setInterval(() => {
    runPollingCycle().catch((error) => {
      console.error("[polling-error]", error.message);
    });
  }, config.pollIntervalSeconds * 1000);
}

main().catch((error) => {
  console.error("[fatal]", error);
  process.exit(1);
});
