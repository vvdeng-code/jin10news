# jin10 news

`jin10 news` 是一个针对伊朗相关重大事件的邮件提醒机器人，数据源来自金十快讯。
当前版本的目标不是"尽量多推"，而是"只推结果，不推过程中的烟雾弹"。

项目来源是金十官网 [https://www.jin10.com/](https://www.jin10.com/)，抓取方式参考了金十快讯项目里的公开快讯接口：`https://flash-api.jin10.com/get_flash_list?channel=-8200&vip=1`。

## 架构概览

两层过滤 + 定时汇总：

```
金十快讯 (每 60s 轮询)
     ↓
Layer 1: 关键词过滤 (rules.js)
  - 锚点词：伊朗/美伊/霍尔木兹/革命卫队/核协议 等
  - 标题噪音黑名单：油价/黄金/MSCI/央行/航司 等市场主题直接剃掉
     ↓
Layer 2: AI 分类器 (classifier.js, claude-haiku-4-5)
  - 判断是否为"伊朗局势的真实状态变化"
  - 返回 {push, topic, statusKey, breakQuietHours, reason}
     ↓
静默时段判断 (00:00-09:00 Asia/Shanghai)
  ├─ 白天：立即发实时邮件
  └─ 夜间：进队列，等 9 点汇总
     ↓
早上 9 点：并行发两封独立邮件
  ├─ 重点精华版（夜间队列有内容时）
  └─ 金十数据整理：中东局势跟踪（当天官方发过就转发）
```

## 推送判断标准（AI Prompt 核心）

一条新闻要被推送，需同时满足：

**1. 是状态改变，不是过程描述**

| 推送（状态改变） | 不推（过程描述） |
|---|---|
| 美军已开火拦截伊朗货船 | 美伊代表团举行谈判 |
| 伊朗宣布关闭霍尔木兹海峡 | 双方就分歧进行最后弥合 |
| 伊朗议会已决定继续谈判 | 谈判可能延长一天 |

**2. 是已发生的事实或官方决定，不是预测/威胁/表态**

| 推送（事实/决定） | 不推（预测/表态） |
|---|---|
| 美军开火拦截伊朗货船 | 美军准备在未来几天拦截 |
| 停火协议正式生效 | 预计会谈将取得积极进展 |
| 伊朗政府已决定关闭海峡 | 伊朗警告可能关闭海峡 |

**3. 关键区分**

- "伊朗宣布海峡关闭" → 推（官方宣布状态变化）
- "伊朗警告可能关闭海峡" → 不推（威胁，非事实）
- 新闻同时含已发生事实和未来承诺 → 按已发生部分判断，不因"将报复"而否决整条

**4. 过滤掉的噪音类型**

- 纯表态/威胁/警告（没有实际行动）
- 预测/分析（可能、预计、或将）
- 经济影响（油价、金价、市场反应、航运成本）
- 历史回顾/评论文章

## 推送时间窗口

**白天实时推送（`09:00 - 次日 00:00 Asia/Shanghai`）：**
命中 AI 分类器即立即发实时邮件。

**夜间静默（`00:00 - 09:00 Asia/Shanghai`）：**
继续抓取，所有命中事件进入队列，等早上 9 点汇总（不再有 `breakQuietHours` 的例外——夜间一律不吵人）。

**早上 9 点：并行发两封独立邮件**

1. **重点精华版**（如果夜间队列非空）
   - 按 `topic` 聚合，最多展开 3 条事件线
   - 每条显示最终状态 + 1-3 条关键节点
2. **金十数据整理：中东局势跟踪**（如果当天金十有发且还没转发）
   - 直接转发官方整理的全文

两封邮件各自独立判断，今天发过就明天再发。

## 邮件格式

### 实时结果邮件

主题：新闻标题本身

```text
伊朗革命卫队：霍尔木兹海峡允许非军事船只通过
```

正文：

```text
标题：伊朗革命卫队：霍尔木兹海峡允许非军事船只通过
摘要：伊朗革命卫队发言人表示...(金十数据APP)
来源：金十数据
链接：https://flash.jin10.com/detail/202604...
时间：2026-04-14 08:42:00 (Asia/Shanghai)
```

### 早间重点精华版

主题：`重点精华版`

正文：

```text
时间段：2026-04-14 00:00 - 09:00 (Asia/Shanghai)

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

### 金十中东局势跟踪

主题：原标题（如 `金十数据整理：中东局势跟踪（4月15日）`）

正文：

```text
标题：金十数据整理：中东局势跟踪（4月15日）
内容：
①伊朗
1. ……
2. ……

②美国
1. ……

③停火谈判
1. ……
来源：金十数据
链接：https://flash.jin10.com/detail/202604...
时间：2026-04-15 09:12:00 (Asia/Shanghai)
```

## Quick start

1. 安装依赖：

```bash
npm install
```

2. 创建 env 文件：

```bash
cp .env.example .env
```

3. 填写 `.env` 必需项：

- `GMAIL_USER` — 发件 Gmail 账号
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Gmail OAuth2 凭证
- `GOOGLE_REFRESH_TOKEN` — 通过 `npm run oauth:gmail` 生成
- `EMAIL_TO` — 收件人（逗号分隔多个）
- `ANTHROPIC_API_KEY` — 用于 AI 分类器

可选配置：

- `EMAIL_FROM`（默认等于 `GMAIL_USER`）
- `EMAIL_SUBJECT_PREFIX`（邮件主题前缀）
- `POLL_INTERVAL_SECONDS`（默认 `60`）
- `QUIET_HOURS_START`（默认 `0`）
- `QUIET_HOURS_END`（默认 `9`）
- `MORNING_DIGEST_MAX_TOPICS`（默认 `3`）
- `TOPIC_STATE_WINDOW_HOURS`（默认 `168`，同事件线状态去重窗口）

4. 生成 Gmail OAuth2 refresh token：

```bash
npm run oauth:gmail
```

5. 运行：

```bash
npm start
```

## Gmail OAuth2 setup

1. 在 Google Cloud 创建或选择一个项目
2. 为该项目启用 Gmail API
3. 配置 OAuth consent screen
4. 创建 `Desktop app` 类型的 OAuth Client ID
5. 把 Client ID / Client Secret 填到 `.env`
6. `GMAIL_USER` 设为发件邮箱，`EMAIL_TO` 设为收件邮箱
7. 运行 `npm run oauth:gmail`，打开打印的 URL，授权后把返回的 refresh token 填到 `.env`

## Useful commands

```bash
npm run poll          # 单次轮询（调试用）
npm run oauth:gmail   # 生成 Gmail OAuth2 token
npm start             # 常驻运行
```

## 持久化运行（macOS launchd）

推荐用 launchd 跑常驻服务（关掉终端也继续运行）。参考 plist 模板：`~/Library/LaunchAgents/com.vinotech.jin10news.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vinotech.jin10news</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/node</string>
        <string>src/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/project</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key>
    <string>/Users/YOU/Library/Logs/jin10news.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/YOU/Library/Logs/jin10news.log</string>
</dict>
</plist>
```

加载 / 卸载：

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.vinotech.jin10news.plist
launchctl bootout   gui/$(id -u) ~/Library/LaunchAgents/com.vinotech.jin10news.plist
```

查看日志：

```bash
tail -f ~/Library/Logs/jin10news.log
```

> **注意：** `WorkingDirectory` 不能带空格（launchd 会以 exit code 78 拒绝）。如果项目路径含空格，建议在 home 目录做个软链指过去：`ln -s "/path/with spaces/project" ~/jin10news`，plist 里写 `~/jin10news`。

## Notes

1. 状态历史、已发 ID、夜间队列、中东局势跟踪缓存都保存在 `data/store.json`
2. 同一 `topic` + `statusKey` 在 `TOPIC_STATE_WINDOW_HOURS` 内不重复推送
3. AI 分类器调用用的是 `claude-haiku-4-5`，成本低、速度快
