import fs from "node:fs/promises";
import path from "node:path";

const EMPTY = {
  events: [],
  sent: [],
  digestQueue: [],
  meta: {
    lastMorningDigestDate: null,
    officialMiddleEastDigest: null
  }
};

export class FileStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.write(EMPTY);
    }
  }

  async read() {
    const raw = await fs.readFile(this.filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      sent: Array.isArray(parsed.sent) ? parsed.sent : [],
      digestQueue: Array.isArray(parsed.digestQueue) ? parsed.digestQueue : [],
      meta:
        parsed.meta && typeof parsed.meta === "object"
          ? {
              lastMorningDigestDate:
                typeof parsed.meta.lastMorningDigestDate === "string"
                  ? parsed.meta.lastMorningDigestDate
                  : null,
              officialMiddleEastDigest:
                parsed.meta.officialMiddleEastDigest &&
                typeof parsed.meta.officialMiddleEastDigest === "object"
                  ? parsed.meta.officialMiddleEastDigest
                  : null
            }
          : { ...EMPTY.meta }
    };
  }

  async write(data) {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  async rememberSent(hash) {
    const data = await this.read();
    if (!data.sent.includes(hash)) data.sent.push(hash);
    await this.write(data);
  }

  async hasSent(hash) {
    const data = await this.read();
    return data.sent.includes(hash);
  }

  async addEvent(event) {
    const data = await this.read();
    data.events.push(event);
    await this.write(data);
  }

  async latestEventForTopic(stream, topic, sinceEpochMs) {
    const data = await this.read();
    return data.events
      .filter(
        (event) =>
          event.stream === stream &&
          event.topic === topic &&
          (event.occurredAtMs ?? event.createdAtMs) >= sinceEpochMs
      )
      .sort((a, b) => (b.occurredAtMs ?? b.createdAtMs) - (a.occurredAtMs ?? a.createdAtMs))[0] ?? null;
  }

  async queueDigestEvent(event) {
    const data = await this.read();
    data.digestQueue.push(event);
    await this.write(data);
  }

  async getDigestQueue() {
    const data = await this.read();
    return [...data.digestQueue].sort(
      (a, b) => (a.occurredAtMs ?? a.createdAtMs) - (b.occurredAtMs ?? b.createdAtMs)
    );
  }

  async clearDigestQueue() {
    const data = await this.read();
    data.digestQueue = [];
    await this.write(data);
  }

  async getMeta() {
    const data = await this.read();
    return data.meta;
  }

  async setLastMorningDigestDate(dateKey) {
    const data = await this.read();
    data.meta.lastMorningDigestDate = dateKey;
    await this.write(data);
  }

  async getOfficialMiddleEastDigest() {
    const data = await this.read();
    return data.meta.officialMiddleEastDigest ?? null;
  }

  async setOfficialMiddleEastDigest(item) {
    const data = await this.read();
    data.meta.officialMiddleEastDigest = item;
    await this.write(data);
  }

  async clearOfficialMiddleEastDigest() {
    const data = await this.read();
    data.meta.officialMiddleEastDigest = null;
    await this.write(data);
  }
}
