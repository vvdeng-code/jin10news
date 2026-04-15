# jin10 news

`jin10 news` 是一个针对伊朗相关重大事件的邮件提醒机器人，数据源来自金十快讯。  
当前版本的目标不是“尽量多推”，而是“只推结果，不推过程中的烟雾弹”。

项目来源是金十官网 [https://www.jin10.com/](https://www.jin10.com/)，抓取方式参考了金十快讯项目里的公开快讯接口：`https://flash-api.jin10.com/get_flash_list?channel=-8200&vip=1`。

## 当前推送策略

系统只保留 4 条事件线：

1. `美伊谈判`
2. `霍尔木兹海峡`
3. `停火与军事行动`
4. `制裁与资产`

只有同时满足下面两点才会进入推送逻辑：

1. 金十快讯自身 `important=1`
2. 命中伊朗相关语境和“结果级”表述

## 什么会推

### 实时推送

白天 `09:00-23:00` 只推“结果级消息”：

- `正式达成协议`
- `谈判结束，未达成协议`
- `谈判重启窗口明确`
- `封锁开始执行`
- `恢复通航`
- `停火正式生效`
- `停火破裂或重新开火`
- `重大军事行动开始`
- `重大制裁或资产安排生效`
- `重大制裁安排明确收紧`

同一事件线只有在“状态改变”时才会再次推送。

例子：

- `伊朗称谈判已结束 与美国未达成协议`
- `特朗普：伊朗战事“接近结束”，未来两天或重启谈判`
- `美官员：美政府本周将终止伊朗海上石油制裁豁免`
- `美军已开始对进出霍尔木兹海峡的船只进行阻截`
- `停火协议正式生效`
- `解除封锁，恢复通航`

### 夜间静默

默认静默时间：`23:00-09:00 (Asia/Shanghai)`。

夜间继续抓取，但绝大多数结果不实时发，而是进入第二天早上的汇总邮件。  
只有下面这些“破静默”级结果会夜里照常实时推送：

- `霍尔木兹海峡封锁开始执行`
- `霍尔木兹海峡恢复通航`
- `停火正式生效`
- `停火破裂或重新开火`
- `重大军事行动开始`
- `正式达成协议`

### 早晨汇总

`23:00-08:59` 期间抓到的非破静默结果，会在第二天 `09:00` 左右汇总成一封邮件。

系统会优先发送金十官方整理标题 `金十数据整理：中东局势跟踪（4月15日）` 这一类晨报。

- 如果抓到了这条官方整理，就直接转发它
- 如果到 `OFFICIAL_DIGEST_FALLBACK_HOUR` 还没抓到，才回退为我们自己的事件线汇总

回退汇总邮件按“事件线”组织，而不是按“新闻条数”堆列表：

- 每条事件线只显示一个最终状态
- 附带 `1-3` 条关键节点
- 没有结果级变化就不发晨报

## 什么不会推

以下内容默认视为过程、表态或噪音，直接忽略：

- `启程`、`抵达`、`离开`
- `会见`、`会晤`、`访问`
- `将举行`、`计划`、`准备`、`考虑`
- `可能`、`预计`、`有望`、`乐观`
- `继续进行`、`磋商`、`讨论`、`通报进展`
- `前提条件`、`红线`
- `消息人士`、`知情人士`、`据悉`、`被曝`
- `几艘船通过霍尔木兹海峡`
- `油价暴涨`、`月报`、`供应链冲击`
- `正文里的历史背景提到曾经达成协议`

例子：

- `参加美伊谈判的美方代表团抵达巴基斯坦`
- `预计与伊朗的会谈将取得积极进展`
- `下一轮谈判可能在几天内举行`
- `过去24小时内，三艘油轮通过霍尔木兹海峡`
- `特朗普态度摇摆：先排除、后改口仍倾向巴基斯坦作为美伊谈判地`
- `美官员：未全面封锁霍尔木兹海峡 仅针对进出伊朗港口船只`

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
