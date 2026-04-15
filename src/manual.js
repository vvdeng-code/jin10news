import { config } from "./config.js";
import { createEmailSender } from "./email.js";
import { processIncomingItems } from "./engine.js";
import { pullAllSources } from "./sources.js";
import { FileStore } from "./store.js";

async function run() {
  if (config.missingRequiredEnv.length > 0) {
    console.error(`Missing required env: ${config.missingRequiredEnv.join(", ")}`);
    process.exit(1);
  }

  const store = new FileStore(config.storePath);
  await store.init();

  const sendFn = createEmailSender(config);
  const cmd = process.argv[2];

  if (cmd === "poll") {
    const items = await pullAllSources(config.sources);
    const stats = await processIncomingItems(items, store, sendFn);
    console.log(
      `Manual poll done. fetched=${stats.total} matched=${stats.matched} sentRealtime=${stats.sentRealtime} queuedDigest=${stats.queuedDigest} sentDigest=${stats.sentDigest} digestEvents=${stats.digestEvents} alreadySent=${stats.alreadySent} skippedSameState=${stats.skippedSameState} failedSends=${stats.failedSends}`
    );
    return;
  }

  console.log("Usage: npm run poll");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
