import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { passesLayer1 } from "./rules.js";

export const STREAM_IRAN = "iran";

const SYSTEM_PROMPT = `你是一个伊朗形势监控助手。判断金十快讯是否属于"伊朗重大事件"，决定是否推送提醒。

核心目标：抓住伊朗局势的每一次真实变化——军事行动、封锁、谈判结果、停火、核协议——任何让局势"跳到新状态"的事件都要推送。

【推送】以下类型直接推：
- 军事行动发生：开火、空袭、扣船、无人机攻击、登船
- 封锁/海峡：关闭、开放、限制通行、禁止船只
- 官方宣布状态：伊朗/美国正式宣布某事已发生（即使描述简短）
- 谈判结果：协议达成、谈判破裂、停火生效或破裂、已决定重启/继续/退出谈判
- 重大升级或降级：停战、撤军、制裁生效
- 官方决定：政府/议会"已决定"做某事（已决定继续谈判、已决定关闭海峡等）

【不推送】以下类型过滤掉：
- 纯表态/威胁/警告（没有实际行动）：如"将予以报复"、"绝不放弃"、"警告美国"
- 过程描述：正在谈判、将举行会谈、磋商进行中
- 预测/分析：可能、预计、或将、分析师认为
- 经济影响：油价、金价、市场反应、航运成本
- 历史回顾/评论文章

【关键区分】
- "伊朗宣布海峡关闭" → 推（官方宣布状态变化）
- "伊朗警告可能关闭海峡" → 不推（威胁，非事实）
- "美军开火拦截伊朗货船" → 推（具体军事行动）
- "美军准备在未来几天拦截" → 不推（未发生）
- 新闻同时含已发生事实和未来承诺 → 按已发生部分判断，不因"将报复"而否决整条

来源要求：官方机构、政府发言人、军方声明、主流媒体引用官方。匿名消息人士须有明确事实词且无不确定修饰。

直接输出JSON，禁止用代码块包裹，不要任何其他内容：
{
  "push": true或false,
  "topic": "military|strait|talks|nuclear|sanction|other",
  "topicLabel": "事件线中文名（如：美伊军事冲突、霍尔木兹海峡、美伊谈判）",
  "statusKey": "snake_case描述此次状态（如：military_action_started、strait_closed、talks_failed）",
  "statusLabel": "简短中文状态描述（如：美军开火拦截伊朗货船、海峡宣布关闭）",
  "breakQuietHours": true或false,
  "reason": "一句话说明推送或不推送的理由"
}

breakQuietHours=true：军事行动、封锁开始/解除、停火生效/破裂、协议达成——任何数小时内直接影响局势的事件。`;

let anthropicClient = null;

function getClient(appConfig = config) {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: appConfig.anthropicApiKey });
  }
  return anthropicClient;
}

export async function classifyNews(item, appConfig = config) {
  if (!passesLayer1(item)) return null;

  const userMessage = [
    `标题：${item.title ?? ""}`,
    `摘要：${item.summary ?? ""}`,
    `来源：${item.source ?? ""}`
  ].join("\n");

  console.log(`[classifier] calling AI for: ${item.title}`);

  let text;
  try {
    const response = await getClient(appConfig).messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }]
    });
    text = response.content[0]?.type === "text" ? response.content[0].text : "";
  } catch (error) {
    console.error("[classifier] AI call failed:", error.message);
    return null;
  }

  let result;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    result = JSON.parse(match ? match[0] : text);
  } catch {
    console.error("[classifier] Failed to parse AI response:", text.slice(0, 200));
    return null;
  }

  if (!result.push) {
    console.log(`[classifier] not pushing: ${result.reason ?? "no reason given"}`);
    return null;
  }

  console.log(`[classifier] push=true topic=${result.topic} status=${result.statusKey}`);

  return {
    stream: STREAM_IRAN,
    topic: result.topic ?? "other",
    topicLabel: result.topicLabel ?? "伊朗形势",
    statusKey: result.statusKey ?? "major_event",
    statusLabel: result.statusLabel ?? "重大事件",
    breakQuietHours: result.breakQuietHours === true
  };
}
