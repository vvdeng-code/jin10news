export const STREAM_IRAN = "iran";

const IRAN_CONTEXT_KEYWORDS = [
  "iran",
  "iranian",
  "伊朗",
  "美伊",
  "伊美",
  "霍尔木兹",
  "霍尔木兹海峡",
  "阿曼湾",
  "伊斯兰堡"
];

const WEAK_SOURCE_KEYWORDS = ["消息人士", "知情人士", "据悉", "被曝"];

const PROCESS_NOISE_KEYWORDS = [
  "启程",
  "抵达",
  "离开",
  "会见",
  "会晤",
  "访问",
  "将举行",
  "将于",
  "或于",
  "计划",
  "准备",
  "拟",
  "考虑",
  "可能",
  "预计",
  "有望",
  "乐观",
  "暗示",
  "倾向于",
  "不排除",
  "或将",
  "继续进行",
  "磋商",
  "讨论",
  "弥合分歧",
  "通报进展",
  "前提条件",
  "红线",
  "回应",
  "警告",
  "重申",
  "评估",
  "人员组成",
  "通过霍尔木兹海峡",
  "驶过",
  "油价",
  "月报",
  "供应链",
  "全球财经早餐",
  "期货热点追踪",
  "视频"
];

const HARD_RESULT_KEYWORDS = [
  "正式",
  "生效",
  "已开始",
  "开始执行",
  "即刻起",
  "已结束",
  "未达成协议",
  "达成协议",
  "解除封锁",
  "恢复通航",
  "停火生效",
  "停火结束",
  "重新开火",
  "封锁霍尔木兹海峡",
  "封锁伊朗港口海上交通"
];

const RESULT_RULES = [
  {
    topic: "strait",
    topicLabel: "霍尔木兹海峡",
    statusKey: "strait_blockade_started",
    statusLabel: "封锁开始执行",
    breakQuietHours: true,
    patterns: [
      /即刻起.{0,12}封锁霍尔木兹海峡/u,
      /全面封锁霍尔木兹海峡/u,
      /霍尔木兹海峡.{0,8}(?:已被|开始被|实施)封锁/u,
      /已开始对进出霍尔木兹海峡的船只进行阻截/u,
      /开始对进出霍尔木兹海峡的船只进行阻截/u,
      /将封锁霍尔木兹海峡.{0,12}未经授权船只不允许通过/u
    ],
    skipIfPatterns: [
      /未全面封锁霍尔木兹海峡/u,
      /并未.{0,8}封锁霍尔木兹海峡/u,
      /没有.{0,8}封锁霍尔木兹海峡/u,
      /否认.{0,12}封锁霍尔木兹海峡/u,
      /仅针对进出伊朗港口船只/u
    ]
  },
  {
    topic: "strait",
    topicLabel: "霍尔木兹海峡",
    statusKey: "strait_reopened",
    statusLabel: "恢复通航",
    breakQuietHours: true,
    patterns: [/恢复通航/u, /解除封锁/u, /允许非军事船只通过/u, /恢复开放/u]
  },
  {
    topic: "ceasefire",
    topicLabel: "停火与军事行动",
    statusKey: "ceasefire_effective",
    statusLabel: "停火正式生效",
    breakQuietHours: true,
    patterns: [/停火(?:协议)?(?:正式)?生效/u, /正式停火/u, /达成停火协议/u],
    skipIfPatterns: [
      // 过程句："正在/努力/争取达成停火协议"
      /(?:正在|努力|争取|试图|寻求|讨论|推动).{0,12}达成停火协议/u
    ]
  },
  {
    topic: "ceasefire",
    topicLabel: "停火与军事行动",
    statusKey: "ceasefire_broken",
    statusLabel: "停火破裂或重新开火",
    breakQuietHours: true,
    patterns: [/停火(?:协议)?破裂/u, /停火结束/u, /重新开火/u]
  },
  {
    topic: "ceasefire",
    topicLabel: "停火与军事行动",
    statusKey: "military_action_started",
    statusLabel: "重大军事行动开始",
    breakQuietHours: true,
    patterns: [
      /开始(?:发动|实施).{0,8}(?:袭击|空袭|打击|报复行动)/u,
      /(?:发动|实施).{0,8}(?:袭击|空袭|打击|报复行动).{0,4}开始/u
    ]
  },
  {
    topic: "talks",
    topicLabel: "美伊谈判",
    statusKey: "talks_failed",
    statusLabel: "谈判结束，未达成协议",
    breakQuietHours: false,
    patterns: [
      /谈判已结束.{0,16}未达成协议/u,
      /未达成协议/u,
      /未能达成协议/u,
      /谈判.{0,12}(?:没谈拢|未谈拢)/u,
      /会谈.{0,12}(?:没谈拢|未谈拢)/u,
      /谈崩/u,
      /谈判破裂/u,
      /无果而终/u,
      /中止谈判/u,
      /取消谈判/u
    ],
    skipIfPatterns: [
      // 假设句："若/如果/一旦未达成协议，则..."
      /(?:若|如果|一旦|假如).{0,20}未(?:能)?达成协议/u,
      // 条件结果句："未达成协议将/则采取..."
      /未(?:能)?达成协议.{0,20}(?:将|则|会|就).{0,10}(?:采取|启动|动用|实施|考虑)/u
    ]
  },
  {
    topic: "talks",
    topicLabel: "美伊谈判",
    statusKey: "agreement_reached",
    statusLabel: "正式达成协议",
    breakQuietHours: true,
    patterns: [
      /(?:美伊|伊美|美国与伊朗|伊朗与美国).{0,20}(?:正式)?达成(?:框架)?协议/u,
      /(?:美伊|伊美|美国与伊朗|伊朗与美国).{0,20}签署.{0,8}协议/u,
      /(?:谈判|会谈).{0,12}(?:正式)?达成(?:框架)?协议/u,
      /(?:谈判|会谈).{0,12}签署.{0,8}协议/u
    ],
    skipIfPatterns: [
      // "达成协议是很有可能的" / "达成协议'是很有可能的'"
      /是很有可能/u,
      /"是.{0,4}可能"/u,
      // "对达成协议持乐观态度"
      /持乐观态度/u,
      /对.{0,12}达成.{0,8}(?:乐观|有望)/u,
      // "可能是达成协议的最后机会"
      /可能是.{0,10}(?:最后机会|唯一机会)/u,
      // "就大多数问题达成一致"（近似命中但未真正达成）
      /大多数问题达成一致/u,
      // 否定句
      /未能达成.{0,4}协议/u,
      /没有达成.{0,4}协议/u,
      /并未达成.{0,4}协议/u
    ]
  },
  {
    topic: "talks",
    topicLabel: "美伊谈判",
    statusKey: "talks_restart_window",
    statusLabel: "谈判重启窗口明确",
    breakQuietHours: false,
    allowProcessNoise: true,
    patterns: [
      /(?:特朗普|美国总统特朗普|美国总统).{0,30}(?:未来两天|两天内|48小时内).{0,12}(?:重启谈判|恢复谈判)/u,
      /(?:特朗普|美国总统特朗普|美国总统).{0,30}(?:本周|短期内).{0,12}(?:重启谈判|恢复谈判)/u
    ]
  },
  {
    topic: "sanction",
    topicLabel: "制裁与资产",
    statusKey: "sanctions_effective",
    statusLabel: "重大制裁或资产安排生效",
    breakQuietHours: false,
    patterns: [/制裁(?:正式)?生效/u, /解除制裁/u, /资产解冻/u, /冻结资产.{0,6}(?:释放|解冻)/u]
  },
  {
    topic: "sanction",
    topicLabel: "制裁与资产",
    statusKey: "sanctions_tightening_announced",
    statusLabel: "重大制裁安排明确收紧",
    breakQuietHours: false,
    allowProcessNoise: true,
    patterns: [
      /(?:美官员|美国政府|白宫|特朗普).{0,20}(?:本周|将|拟|计划).{0,10}终止.{0,20}伊朗.{0,12}(?:海上石油)?制裁豁免/u,
      /终止伊朗海上石油制裁豁免/u
    ]
  }
];

function normalize(text) {
  return (text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(haystack, words) {
  return words.some((word) => haystack.includes(word));
}

function matchesAny(haystack, patterns) {
  return patterns.some((pattern) => pattern.test(haystack));
}

function isImportantItem(item) {
  return item.important === true || item.important === 1 || item.important === "1";
}

function buildBody(parts) {
  return parts.map(normalize).filter(Boolean).join(" ").trim();
}

function buildHeadlineBody(item) {
  return buildBody([item.title, item.summary, item.source]);
}

function buildFullBody(item) {
  const title = normalize(item.title);
  const summary = normalize(item.summary);
  const content = normalize(item.content);
  const source = normalize(item.source);
  const url = normalize(item.url);
  return `${title} ${summary} ${content} ${source} ${url}`.trim();
}

function hasIranContext(body) {
  return includesAny(body, IRAN_CONTEXT_KEYWORDS);
}

function looksLikeProcessOnly(body) {
  return includesAny(body, PROCESS_NOISE_KEYWORDS) && !includesAny(body, HARD_RESULT_KEYWORDS);
}

function isWeakSourceOnly(body) {
  return includesAny(body, WEAK_SOURCE_KEYWORDS) && !includesAny(body, HARD_RESULT_KEYWORDS);
}

export function classifyNews(item) {
  if (!isImportantItem(item)) return null;

  const headlineBody = buildHeadlineBody(item);
  const fullBody = buildFullBody(item);
  if (!hasIranContext(fullBody)) return null;

  const matchedRule = RESULT_RULES.find((rule) => matchesAny(headlineBody, rule.patterns));
  if (!matchedRule) return null;

  if (matchedRule.skipIfPatterns && matchesAny(headlineBody, matchedRule.skipIfPatterns)) {
    return null;
  }

  if (looksLikeProcessOnly(headlineBody) && !matchedRule.allowProcessNoise) return null;
  if (isWeakSourceOnly(headlineBody) && !matchedRule.allowWeakSource) return null;

  return {
    stream: STREAM_IRAN,
    topic: matchedRule.topic,
    topicLabel: matchedRule.topicLabel,
    statusKey: matchedRule.statusKey,
    statusLabel: matchedRule.statusLabel,
    breakQuietHours: matchedRule.breakQuietHours
  };
}
