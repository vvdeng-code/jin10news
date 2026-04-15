# jin10 news

`jin10 news` 是一个针对伊朗相关重大事件的邮件提醒机器人，数据源来自金十快讯。  
当前版本的目标不是“尽量多推”，而是“只推结果，不推过程中的烟雾弹”。

项目来源是金十官网 [https://www.jin10.com/](https://www.jin10.com/)，抓取方式参考了金十快讯项目里的公开快讯接口：`https://flash-api.jin10.com/get_flash_list?channel=-8200&vip=1`。

## 推送规则设计原则

本节说明系统如何判断一条新闻是否值得推送，以及如何为新出现的事件类型编写规则。无论伊朗局势如何演变，这套原则保持不变。

### 一、推送的核心判断标准

一条新闻必须同时满足以下三点，才进入推送逻辑：

**1. 是状态改变，不是过程描述**

状态改变 = 事情的性质发生了转折，之前不存在、现在存在，或者反过来。
过程描述 = 事情还在进行中，没有结束，没有转折。

| 状态改变（应推） | 过程描述（不推） |
|---|---|
| 美军已开始对进出霍尔木兹海峡的船只进行阻截 | 美伊代表团举行谈判 |
| 伊朗称谈判已结束，与美国未达成协议 | 美伊谈判可能延长一天 |
| 伊朗革命卫队：霍尔木兹海峡允许非军事船只通过 | 双方就分歧进行最后弥合 |
| 特朗普：核问题没谈拢，即刻起将封锁霍尔木兹海峡 | 伊朗提出谈判前提条件 |

**2. 是已发生的事实，不是预测或表态**

已发生 = 主语已经做了某件事，动词是完成时或现在进行时。
预测/表态 = 说某件事将会发生、可能发生、希望发生。

| 已发生（应推） | 预测或表态（不推） |
|---|---|
| 美军已开始清除水雷 | 特朗普表示与伊朗达成协议”是很有可能的” |
| 停火协议正式生效 | 万斯称预计与伊朗会谈将取得积极进展 |
| 封锁开始执行 | 白宫官员表示特朗普对达成协议持乐观态度 |

**3. 来自可核实的官方主体，不是匿名消息**

可核实主体 = 美国总统、美国中央司令部、伊朗革命卫队、伊朗外长、巴基斯坦外交部等官方身份。
匿名消息 = 消息人士、知情人士、据悉、被曝、媒体援引未具名官员。

匿名消息只有在同时命中结果词且无任何不确定修饰词时才考虑推送，通常直接过滤。

---

### 二、噪音过滤原则

**噪音过滤是最终防线，但执行时已知命中了哪条规则。** 实际执行顺序为：① pattern 匹配 → ② skipIfPatterns 拦截 → ③ 噪音过滤（规则设有 `allowProcessNoise: true` 则跳过）→ ④ 弱源过滤 → ⑤ 推送。噪音过滤不能提前到 pattern 匹配之前，因为 `allowProcessNoise` 是规则属性，不知道命中哪条规则就无法决定是否跳过。

**句式噪音（含以下任意词，直接过滤）：**

```
可能、有可能、或将、预计、有望、乐观、暗示、倾向于、不排除
将举行、将于、或于、计划、准备、拟、考虑
继续进行、磋商、讨论、弥合分歧、通报进展
前提条件、红线、回应、警告、重申、评估
消息人士、知情人士、据悉、被曝
```

**内容噪音（描述以下内容，直接过滤）：**

```
启程、抵达、离开、会见、会晤、访问（外交礼节类）
人员组成（代表团构成）
通过霍尔木兹海峡、驶过（船只通行报告）
油价、月报、供应链、全球财经早餐、期货热点追踪（市场分析类）
视频（金十视频内容）
```

**例外：** 如果一条新闻同时含有噪音词和硬结果词（正式、生效、已开始、开始执行、即刻起、已结束、未达成协议、达成协议、解除封锁、恢复通航），则不过滤，继续往下判断。

---

### 三、误判防护原则（skipIfPatterns）

每个结果规则都必须维护一个 `skipIfPatterns` 列表。它的作用是拦截”表面上看像结果、实际上是预测或修饰”的句子。

**核心规则：结果词被以下任意方式修饰时，一律视为非结果：**

- 结果词出现在引号内，且引号前有”表示/称/说”：
  `特朗普表示，达成协议”是很有可能的”` → 不推
- 结果词后面跟着可能/乐观/有望等修饰：
  `对达成协议持乐观态度` → 不推
- 结果词出现在条件句中：
  `若谈判失败，特朗普准备动用武力` → 不推
- 结果词出现在否定句中：
  `未全面封锁霍尔木兹海峡`、`并未封锁` → 不推

**真实反例（来自历史数据）：**

```
✗ 特朗普表示，美伊达成协议”是很有可能的”
  → 命中 agreement_reached，但应被 skipIfPatterns 拦截
  → 拦截词：/是很有可能/u 或 /”是.{0,4}可能”/u

✗ 白宫官员表示，特朗普对与伊朗达成协议持乐观态度
  → 命中 agreement_reached，但应被拦截
  → 拦截词：/持乐观态度/u

✗ 当前这一轮谈判可能是与美国达成框架协议的”最后机会”
  → 命中 agreement_reached，但应被拦截
  → 拦截词：/可能是.{0,10}(?:最后机会|唯一机会)/u

✗ 特朗普称除核问题外，美伊就”大多数问题达成一致”
  → 近似命中 agreement_reached，但实际未达成
  → 拦截词：/大多数问题达成一致/u
```

---

### 四、事件线扩展模板

当伊朗局势出现当前规则未覆盖的新事件类型时，按以下模板新增规则：

```js
{
  topic: “事件线ID”,           // 同一事件线用同一个ID，便于去重
  topicLabel: “事件线显示名称”,
  statusKey: “状态唯一标识”,   // 同一事件线下不同状态用不同statusKey
  statusLabel: “状态显示名称”, // 出现在邮件主题里
  breakQuietHours: true/false, // 见下方判断标准
  allowProcessNoise: true/false, // 极少数情况下允许含过程词，默认false
  patterns: [
    // 正则：匹配标题+摘要+来源的拼接文本
    // 原则：宁可漏推，不要误推；pattern越具体越好
  ],
  skipIfPatterns: [
    // 正则：命中则强制不推，优先级高于patterns
    // 每新增一个pattern，都要想一想它有没有被修饰词包裹的反例
  ]
}
```

**`breakQuietHours` 判断标准：**

设为 `true`（夜间也立即推送）的条件：事件本身会在数小时内直接影响市场价格或触发军事行动。包括：

- 封锁开始/解除
- 停火生效/破裂
- 开战/空袭开始
- 正式达成协议
- 伊朗对海峡征收通行费
- 官方发出明确打击警告

设为 `false`（等早晨汇总）的条件：重要但不紧迫，数小时内不会有直接后果。包括：

- 谈判陷入僵局
- 本轮谈判结束
- 制裁安排宣布
- 外交邀请/斡旋进展
- 核谈判分歧浮现

**新增事件线前必须回答这三个问题：**

1. 这件事发生后，现状改变了吗？（没有 → 不推）
2. 这是已经发生的事实，还是预测？（预测 → 不推）
3. 这件事在夜里发生，需要立刻叫醒人吗？（需要 → `breakQuietHours: true`）

---

### 五、推送时间窗口

**白天实时推送（`09:00-23:00 Asia/Shanghai`）：** 命中任意结果规则即实时发送。

**夜间静默（`23:00-09:00 Asia/Shanghai`）：** 继续抓取，但只有 `breakQuietHours: true` 的规则会立即推送，其余进入晨报队列。

**早晨汇总（`09:00` 左右）：** 优先转发金十官方整理（`金十数据整理：中东局势跟踪`），未抓到则回退为自建事件线汇总——每条事件线只显示最终状态 + 1-3 条关键节点，没有结果级变化就不发晨报。

## 邮件格式

### 实时结果邮件

主题示例：

```text
美伊谈判：谈判结束，未达成协议
```

正文示例：

```text
类型：重大结果
事件线：美伊谈判
状态：谈判结束，未达成协议
标题：伊朗称谈判已结束 与美国未达成协议
摘要：伊朗称谈判已结束 与美国未达成协议(金十数据APP)。
来源：金十数据
链接：https://flash.jin10.com/detail/202604...
时间：2026-04-14 08:42:00 (Asia/Shanghai)
```

### 夜间结果汇总邮件

如果抓到了金十官方整理，晨报会优先使用这类标题：

```text
金十数据整理：中东局势跟踪（4月15日）
```

正文示例：

```text
标题：金十数据整理：中东局势跟踪（4月15日）
内容：
①伊朗
1. ……
2. ……

②美国
1. ……
2. ……

③停火谈判
1. ……
来源：金十数据
链接：https://flash.jin10.com/detail/202604...
时间：2026-04-15 09:12:00 (Asia/Shanghai)
```

如果没抓到官方整理，才会回退为下面这种自建夜间结果汇总：

主题示例：

```text
【夜间结果】2条重大更新
```

正文示例：

```text
夜间重大结果汇总
时间窗口：2026-04-13 23:00 - 2026-04-14 09:00 (Asia/Shanghai)

1. 霍尔木兹海峡
最终状态：封锁开始执行
结果时间：2026-04-14 00:18:00 (Asia/Shanghai)
关键节点：
- 00:18 封锁开始执行：美军已开始对进出霍尔木兹海峡的船只进行阻截
- 00:31 封锁开始执行：美军：将封锁霍尔木兹海峡 未经授权船只不允许通过
链接：https://flash.jin10.com/detail/202604...

2. 美伊谈判
最终状态：谈判结束，未达成协议
结果时间：2026-04-14 02:45:00 (Asia/Shanghai)
关键节点：
- 02:45 谈判结束，未达成协议：伊朗称谈判已结束 与美国未达成协议
链接：https://flash.jin10.com/detail/202604...
```

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Fill base env vars in `.env`:

- `GMAIL_USER`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `EMAIL_TO`

可选配置：

- `EMAIL_FROM`
- `EMAIL_SUBJECT_PREFIX`
- `POLL_INTERVAL_SECONDS`
- `QUIET_HOURS_START`，默认 `23`
- `QUIET_HOURS_END`，默认 `9`
- `OFFICIAL_DIGEST_FALLBACK_HOUR`，默认 `10`
- `MORNING_DIGEST_MAX_TOPICS`，默认 `3`
- `TOPIC_STATE_WINDOW_HOURS`，默认 `168`

4. Generate Gmail OAuth2 refresh token:

```bash
npm run oauth:gmail
```

5. Run:

```bash
npm start
```

## Gmail OAuth2 setup

1. Create or select a Google Cloud project.
2. Enable the Gmail API for that project.
3. Configure the OAuth consent screen.
4. Create an OAuth client ID with application type `Desktop app`.
5. Copy the generated client ID and client secret into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. Set `GMAIL_USER` to the Gmail account that will send mail.
7. Set `EMAIL_TO` to the mailbox that will receive the alerts.
8. Run `npm run oauth:gmail`, open the printed URL, approve access, and copy the returned `GOOGLE_REFRESH_TOKEN` into `.env`.

## Useful commands

1. Run one polling cycle:

```bash
npm run poll
```

2. Generate Gmail OAuth2 token:

```bash
npm run oauth:gmail
```

## Notes

1. 状态历史、去重状态和夜间汇总队列都会保存在 `data/store.json`。
2. 同一事件线在状态不变时不会重复推送。
3. 晨报优先发送金十官方的 `中东局势跟踪`，没抓到才回退到自建结果汇总。
