import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { classifyNews } from "./classifier.js";
import {
  formatShanghaiDateTime,
  getShanghaiDateKey,
  getShanghaiHour,
  parseTimeMs
} from "./utils.js";

const DEFAULT_SUBJECT = "重大结果提醒";

function messageLogLine(message) {
  if (typeof message === "string") {
    return message.split("\n")[0];
  }

  return message.subject ?? message.text?.split("\n")[0] ?? DEFAULT_SUBJECT;
}

function padHour(value) {
  return String(value).padStart(2, "0");
}

function isQuietHours(date, appConfig = config) {
  const hour = getShanghaiHour(date);
  if (appConfig.quietHoursStart === appConfig.quietHoursEnd) return true;
  if (appConfig.quietHoursStart < appConfig.quietHoursEnd) {
    return hour >= appConfig.quietHoursStart && hour < appConfig.quietHoursEnd;
  }
  return hour >= appConfig.quietHoursStart || hour < appConfig.quietHoursEnd;
}

function createEvent(item, classification) {
  const occurredAtMs = parseTimeMs(item.publishedAt, Date.now());
  return {
    id: randomUUID(),
    stream: classification.stream,
    topic: classification.topic,
    topicLabel: classification.topicLabel,
    statusKey: classification.statusKey,
    statusLabel: classification.statusLabel,
    source: item.source,
    title: item.title,
    summary: item.summary,
    content: item.content ?? item.summary,
    url: item.url,
    important: item.important ?? false,
    createdAtMs: Date.now(),
    occurredAtMs,
    publishedAt: item.publishedAt,
    breakQuietHours: classification.breakQuietHours
  };
}

function renderRealtimeAlert(event) {
  const lines = [
    `标题：${event.title}`,
    `摘要：${event.summary}`,
    `来源：${event.source}`,
    event.url ? `链接：${event.url}` : null,
    `时间：${formatShanghaiDateTime(new Date(event.occurredAtMs))} (Asia/Shanghai)`
  ].filter(Boolean);

  return lines.join("\n");
}

function createRealtimeMessage(event) {
  return {
    subject: event.title,
    text: renderRealtimeAlert(event)
  };
}

function createOfficialMiddleEastDigestRecord(item) {
  const occurredAtMs = parseTimeMs(item.publishedAt, Date.now());
  return {
    externalId: item.externalId,
    source: item.source,
    title: item.title,
    summary: item.summary,
    content: item.content ?? item.summary,
    url: item.url,
    publishedAt: item.publishedAt,
    occurredAtMs
  };
}

function renderOfficialMiddleEastDigest(digest) {
  const lines = [
    `标题：${digest.title}`,
    "内容：",
    digest.content,
    `来源：${digest.source}`,
    digest.url ? `链接：${digest.url}` : null,
    `时间：${formatShanghaiDateTime(new Date(digest.occurredAtMs))} (Asia/Shanghai)`
  ].filter(Boolean);

  return lines.join("\n");
}

function createOfficialMiddleEastDigestMessage(digest) {
  return {
    subject: digest.title,
    text: renderOfficialMiddleEastDigest(digest)
  };
}

function buildQuietWindowLabel(now, appConfig = config) {
  const dateKey = getShanghaiDateKey(now);
  return `${dateKey} ${padHour(appConfig.quietHoursStart)}:00 - ${padHour(appConfig.quietHoursEnd)}:00`;
}

function groupDigestEvents(events) {
  const grouped = new Map();

  for (const event of events) {
    const existing = grouped.get(event.topic);
    if (!existing) {
      grouped.set(event.topic, {
        topic: event.topic,
        topicLabel: event.topicLabel,
        latest: event,
        timeline: [event]
      });
      continue;
    }

    existing.timeline.push(event);
    if ((event.occurredAtMs ?? event.createdAtMs) >= (existing.latest.occurredAtMs ?? existing.latest.createdAtMs)) {
      existing.latest = event;
      existing.topicLabel = event.topicLabel;
    }
  }

  return [...grouped.values()].sort(
    (a, b) => (b.latest.occurredAtMs ?? b.latest.createdAtMs) - (a.latest.occurredAtMs ?? a.latest.createdAtMs)
  );
}

function renderDigestCard(group) {
  const timeline = [...group.timeline]
    .sort((a, b) => (a.occurredAtMs ?? a.createdAtMs) - (b.occurredAtMs ?? b.createdAtMs))
    .slice(-3);

  const lines = [
    group.topicLabel,
    `最终状态：${group.latest.statusLabel}`,
    `结果时间：${formatShanghaiDateTime(new Date(group.latest.occurredAtMs ?? group.latest.createdAtMs))} (Asia/Shanghai)`,
    "关键节点：",
    ...timeline.map(
      (event) =>
        `- ${formatShanghaiDateTime(new Date(event.occurredAtMs ?? event.createdAtMs)).slice(11, 16)} ${
          event.statusLabel
        }：${event.title}`
    ),
    group.latest.url ? `链接：${group.latest.url}` : null
  ].filter(Boolean);

  return lines.join("\n");
}

function createDigestMessage(events, appConfig = config, now = new Date()) {
  const grouped = groupDigestEvents(events);
  if (!grouped.length) return null;

  const displayedGroups = grouped.slice(0, appConfig.morningDigestMaxTopics);
  const remaining = grouped.length - displayedGroups.length;
  const windowLabel = buildQuietWindowLabel(now, appConfig);
  const body = [
    `时间段：${windowLabel} (Asia/Shanghai)`,
    "",
    ...displayedGroups.flatMap((group, index) => {
      const cardLines = renderDigestCard(group).split("\n");
      return [`${index + 1}. ${cardLines[0]}`, ...cardLines.slice(1), ""];
    }),
    remaining > 0 ? `另有 ${remaining} 条事件线未展开。` : null
  ]
    .filter((line) => line !== null)
    .join("\n")
    .trim();

  return {
    subject: "重点精华版",
    text: body,
    eventCount: grouped.length
  };
}

async function rememberOfficialMiddleEastDigest(items, store) {
  const candidate = [...items]
    .filter((item) => item.isOfficialMiddleEastDigest === true)
    .sort((a, b) => parseTimeMs(a.publishedAt, 0) - parseTimeMs(b.publishedAt, 0))
    .at(-1);

  if (!candidate) return null;

  const digest = createOfficialMiddleEastDigestRecord(candidate);
  const current = await store.getOfficialMiddleEastDigest();
  if (current?.externalId === digest.externalId) return current;

  await store.setOfficialMiddleEastDigest(digest);
  return digest;
}

async function maybeSendMorningDigest(store, sendFn, appConfig = config, now = new Date()) {
  if (isQuietHours(now, appConfig)) {
    return { sent: false, majorSent: false, officialSent: false };
  }

  const meta = await store.getMeta();
  const todayKey = getShanghaiDateKey(now);
  let majorSent = false;
  let officialSent = false;

  // 1. 发重大事件摘要（如果今天还没处理过且队列非空）
  if (meta.lastMajorDigestDate !== todayKey) {
    const queue = await store.getDigestQueue();
    await store.clearDigestQueue();
    await store.setLastMajorDigestDate(todayKey);

    if (queue.length > 0) {
      const digest = createDigestMessage(queue, appConfig, now);
      if (digest) {
        await sendFn({ subject: digest.subject, text: digest.text });
        console.log(`[sent] ${messageLogLine(digest)}`);
        majorSent = true;
      }
    }
  }

  // 2. 发金十官方中东局势跟踪（今天有且还没发过就发）
  if (meta.lastOfficialDigestDate !== todayKey) {
    const officialDigest = await store.getOfficialMiddleEastDigest();
    if (
      officialDigest &&
      getShanghaiDateKey(new Date(officialDigest.occurredAtMs ?? parseTimeMs(officialDigest.publishedAt, 0))) ===
        todayKey
    ) {
      const message = createOfficialMiddleEastDigestMessage(officialDigest);
      await sendFn(message);
      await store.setLastOfficialDigestDate(todayKey);
      console.log(`[sent] ${messageLogLine(message)}`);
      officialSent = true;
    }
  }

  return { sent: majorSent || officialSent, majorSent, officialSent };
}

export async function processIncomingItems(items, store, sendFn, appConfig = config) {
  const stats = {
    total: items.length,
    matched: 0,
    alreadySent: 0,
    skippedSameState: 0,
    sentRealtime: 0,
    queuedDigest: 0,
    sentDigest: 0,
    digestEvents: 0,
    failedSends: 0
  };

  const sorted = [...items].sort(
    (a, b) => parseTimeMs(a.publishedAt, 0) - parseTimeMs(b.publishedAt, 0)
  );
  const stateWindowMs = Math.max(1, appConfig.topicStateWindowHours) * 60 * 60 * 1000;

  await rememberOfficialMiddleEastDigest(sorted, store);

  for (const item of sorted) {
    const sentBefore = await store.hasSent(item.externalId);
    if (sentBefore) {
      stats.alreadySent++;
      continue;
    }

    if (!appConfig.realtimePushEnabled) {
      continue;
    }

    const classification = await classifyNews(item);
    if (!classification) {
      await store.rememberSent(item.externalId);
      continue;
    }
    stats.matched++;

    const event = createEvent(item, classification);
    const latestTopicEvent = await store.latestEventForTopic(
      classification.stream,
      classification.topic,
      event.occurredAtMs - stateWindowMs
    );

    if (latestTopicEvent?.statusKey === classification.statusKey) {
      await store.rememberSent(item.externalId);
      stats.skippedSameState++;
      continue;
    }

    const quietDelivery = isQuietHours(new Date(event.occurredAtMs), appConfig);

    try {
      if (quietDelivery) {
        await store.queueDigestEvent(event);
        stats.queuedDigest++;
      } else {
        await sendFn(createRealtimeMessage(event));
        stats.sentRealtime++;
      }
    } catch (error) {
      stats.failedSends++;
      console.error(`[send-error] ${event.title}:`, error.message);
      continue;
    }

    await store.addEvent(event);
    await store.rememberSent(item.externalId);
  }

  try {
    const digestStats = await maybeSendMorningDigest(store, sendFn, appConfig, new Date());
    if (digestStats.majorSent) stats.sentDigest = 1;
    if (digestStats.officialSent) stats.sentDigest = (stats.sentDigest || 0) + 1;
  } catch (error) {
    stats.failedSends++;
    console.error("[digest-send-error]", error.message);
  }

  return stats;
}

export function previewMorningDigest(events, appConfig = config, now = new Date()) {
  return createDigestMessage(events, appConfig, now);
}
