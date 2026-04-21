import { cleanText, preserveSourceMultilineText, makeHash } from "./utils.js";

const JIN10_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "x-app-id": "bVBF4FyRTn5NJF5n",
  "x-version": "1.0.0"
};

const MIDDLE_EAST_DIGEST_TITLE_RE = /^【?金十数据整理[:：]\s*中东局势跟踪/u;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatFetchError(error) {
  if (error?.name === "AbortError") return "request timeout";
  return error?.message ?? String(error);
}

function isOfficialMiddleEastDigestTitle(input) {
  const title = cleanText(input ?? "", 220);
  return MIDDLE_EAST_DIGEST_TITLE_RE.test(title);
}

function shouldSkipJin10Item(item) {
  if (isOfficialMiddleEastDigestTitle(item.data?.title)) return false;

  if (item.extras?.ad === true) return true;

  const raw = item.data?.content ?? "";
  if (isOfficialMiddleEastDigestTitle(raw)) return false;
  if (/section-news/i.test(raw)) return true;

  const content = cleanText(raw, 5000);
  if (!content || content.length < 5) return true;

  if (/^.{0,30}点击查看[.….]{0,3}$/.test(content)) return true;
  if (content.length < 30 && /点击查看/.test(content)) return true;

  const looksLikeDigest =
    /^[①②③④⑤⑥⑦⑧⑨⑩\d]+[.、)）]/.test(content) || /\n[①②③④⑤⑥⑦⑧⑨⑩]/.test(content);
  if (content.length > 1000 && looksLikeDigest) return true;

  return false;
}

function isJin10Important(raw) {
  return raw.important === true || raw.important === 1 || raw.important === "1";
}

function parseJin10PublishedAt(time) {
  if (!time) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(time)) {
    return `${time.replace(" ", "T")}+08:00`;
  }

  const parsed = new Date(time);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function stripJin10Dateline(text) {
  return text.replace(/^金十数据\d{1,2}月\d{1,2}日讯，?/, "").trim();
}

function extractJin10Title(content, rawTitle) {
  const title = cleanText(rawTitle ?? "", 140);
  if (title) return title;

  const bracketTitle = content.match(/^【([^】]+)】/);
  if (bracketTitle?.[1]) {
    return cleanText(bracketTitle[1].replace(/^(报道|快讯|分析)：/, ""), 140);
  }

  return cleanText(stripJin10Dateline(content).split(/[。；;]\s*/)[0], 140);
}

function extractJin10Summary(content) {
  const bracketTitle = content.match(/^【([^】]+)】/);
  const summary = bracketTitle?.[1]
    ? bracketTitle[1].replace(/^(报道|快讯|分析)：/, "")
    : stripJin10Dateline(content).split(/[。；;]\s*/)[0];

  return cleanText(`${summary}(金十数据APP)。`, 220);
}

function extractJin10Body(content, maxLen = 1200) {
  const withoutTitle = content.replace(/^【[^】]+】/, "");
  const body = stripJin10Dateline(withoutTitle);
  return cleanText(`${body}(金十数据APP)`, maxLen);
}

function mapJin10Item(source, raw) {
  if (shouldSkipJin10Item(raw)) return null;

  const sourceName = source.name;
  const rawContent = raw.data?.content ?? "";
  const content = cleanText(rawContent, 5000);
  const title = extractJin10Title(content, raw.data?.title);
  const summary = extractJin10Summary(content);
  const isOfficialMiddleEastDigest =
    isOfficialMiddleEastDigestTitle(raw.data?.title) || isOfficialMiddleEastDigestTitle(title);
  const fullContent = isOfficialMiddleEastDigest
    ? preserveSourceMultilineText(rawContent, 8000)
    : extractJin10Body(content, 1200);
  const publishedAt = parseJin10PublishedAt(raw.time);

  return {
    externalId: raw.id ? `jin10:${raw.id}` : makeHash(`${sourceName}|${title}|${publishedAt}`),
    source: sourceName,
    title: title || "Untitled",
    summary: summary || content,
    content: fullContent || content,
    important: isJin10Important(raw),
    isOfficialMiddleEastDigest,
    channels: raw.channel ?? [],
    tags: raw.tags ?? [],
    publishedAt,
    url: raw.id ? `https://flash.jin10.com/detail/${raw.id}` : source.siteUrl ?? "https://www.jin10.com/"
  };
}

async function fetchJin10FlashOnce(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), source.timeoutMs ?? 20000);

  try {
    const response = await fetch(source.url, {
      headers: JIN10_HEADERS,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Jin10 API failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    if (payload.status !== 200 || !Array.isArray(payload.data)) {
      throw new Error(`Jin10 API returned unexpected payload: status=${payload.status}`);
    }

    return payload.data
      .slice(0, 50)
      .map((item) => mapJin10Item(source, item))
      .filter(Boolean);
  } finally {
    clearTimeout(timeout);
  }
}

async function pullJin10Flash(source) {
  const retries = Math.max(0, source.retries ?? 2);
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchJin10FlashOnce(source);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await sleep(1000 * (attempt + 1));
    }
  }

  throw new Error(formatFetchError(lastError));
}

export async function pullSourceFeed(source) {
  if (source.type === "jin10-flash") {
    return pullJin10Flash(source);
  }

  throw new Error(`Unsupported source type: ${source.type ?? "unknown"}`);
}

export async function pullAllSources(sources) {
  const results = await Promise.allSettled(sources.map((source) => pullSourceFeed(source)));
  const items = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      items.push(...result.value);
      return;
    }
    const sourceName = sources[index]?.name ?? "unknown";
    console.error(`[source-error] ${sourceName}:`, result.reason?.message ?? result.reason);
  });

  return items;
}
