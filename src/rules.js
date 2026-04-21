// Layer 1: broad keyword filter.
// Goal is high recall — catch all potentially Iran-related important news
// and pass candidates to the AI classifier (layer 2) for final judgment.

const IRAN_ANCHOR_KEYWORDS = [
  // 核心主体
  "伊朗", "iran",
  "美伊", "伊美",
  "伊核",

  // 地理
  "霍尔木兹", "hormuz",
  "波斯湾",

  // 机构/人物
  "革命卫队", "irgc",
  "哈梅内伊",

  // 核问题
  "浓缩铀", "核协议", "核武器",

  // 外交节点（当前美伊谈判地）
  "阿曼", "马斯喀特",

  // 斡旋
  "斡旋"
];

function isImportantItem(item) {
  return item.important === true || item.important === 1 || item.important === "1";
}

function normalize(text) {
  return (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function buildFullBody(item) {
  return [item.title, item.summary, item.content, item.source, item.url]
    .map(normalize)
    .filter(Boolean)
    .join(" ");
}

// 标题精确匹配黑名单（整个标题等于这些词时过滤）
const TITLE_BLOCKLIST = ["视频"];

// 标题关键词黑名单：主角是市场/价格/经济影响，伊朗只是背景
// 这类文章 AI 也会拒绝，但提前过滤省 API 调用
const TITLE_NOISE_KEYWORDS = [
  // 商品价格
  "油价", "原油", "布伦特", "wti", "金价", "黄金", "原金",
  "铜价", "银价", "天然气价",
  // 市场情绪
  "避险", "风险偏好", "市场情绪", "市场反应", "避险情绪",
  // 经济影响
  "经济影响", "通胀", "供应链", "能源价格",
  // 股市/汇市/证券
  "股市", "美股", "美元", "汇率", "期货",
  "msci", "指数", "减持", "加仓", "证券", "券商",
  // 央行/利率
  "央行", "加息", "降息", "利率",
  // 企业/行业动态
  "航司", "航班", "票价",
  "斥资", "抢油", "抢购"
];

export function passesLayer1(item) {
  const title = normalize(item.title);
  if (TITLE_BLOCKLIST.some((t) => title === t)) return false;
  if (TITLE_NOISE_KEYWORDS.some((kw) => title.includes(kw))) return false;
  const body = buildFullBody(item);
  return IRAN_ANCHOR_KEYWORDS.some((kw) => body.includes(kw.toLowerCase()));
}
