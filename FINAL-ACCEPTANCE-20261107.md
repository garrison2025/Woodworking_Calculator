# Woodworking Calculator — V3 交付冻结与最终验收矩阵（2026-11-07）

> **最新 SEO 决定：** 用户已批准五个原 V3 P2 工具及 Materials 分类加入**未来自有域名正式索引范围**。实际生产索引目标是 **42 页**、无额外 `RELEASE_V3_P2_APPROVED` 门禁。请以[正式批准记录](research/V3-P2-SEO-APPROVAL-20261107.md)覆盖本文下方历史“SEO GATED”描述。当前 Pages 预览仍 noindex，域名未购买。

> **结论：软件开发基本完成，正式发布尚未批准。** 本文件把“代码与自动化通过”和“现实木工施工可用/真实打印/域名发布”严格分离。不应继续添加无关功能，也不能把后者未执行的事项伪装成通过。
> **2026-11-07 最新验收范围：** 用户已确认只采用[线上软件验收](research/ONLINE-ONLY-SOFTWARE-ACCEPTANCE-20261107.md)，无需用户亲自打印、试切木料或使用真机验证。最新 [主分支 CI #42354449839](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/42354449839) 的自动化与 Cloudflare 实站源码一致性检查已通过。实体和真机状态仍是 **NOT RUN · 软件验收范围外**，不阻断几何参考工具的软件结案；但不能作为 1:1 打印、结构施工安全或真机辅助技术认证。正式域名与 SEO 发布仍 **NOT RUN**，原 V3 P2 未获索引批准。
> **来源优先级：** 用户上传的《Woodworking Calculator 完整开发方案 V3》是产品基线；当前仓库源码和可重放测试作为实现证据。V3 规定 9 P0 + 17 P1 交付，5 P2 后备；仓库后来实现了全部 31 个，并将原 5 个 P2 提升为 P1。这是**实现范围扩大**，不等于这 5 项已获得正式搜索索引/专业施工批准。

## 一次性交付门槛与证据

| 门槛 | 状态 | 证据/实际边界 |
|---|---|---|
| V3 26 个计划 P0/P1 工具 | PASS（自动化） | `src/tools.json`；`tests/calculators.test.mjs` 每工具 8 类共享断言 + 各项独立算法测试；`tests/e2e/sitewide-contract.spec.mjs` 31 页逐页核查 in/mm 结果、SVG、CSV；[基线主分支 CI #705](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/42329946906) |
| 原 5 个 P2 | IMPLEMENTED / SEO GATED | 在源码中标记为 P1，实际功能进入预览；即使未来 `RELEASE_APPROVED=1`，也必须另行设置 `RELEASE_V3_P2_APPROVED=1` 才能纳入 sitemap、生成 canonical、标记 index；此开关不是专业施工审批 |
| 31 个默认黄金值及无效输入 | PASS（自动化） | 每工具至少 8 类独立共享 Node 验证：黄金值、有限几何/清单、决定性、原参数不变、5 单位等价、负数、NaN/∞/超大值、无效零值；另有专项边界/比例/报价/图纸测试 |
| 31 页屏幕结果、SVG、CSV | PASS（自动化默认场景） | `tests/e2e/sitewide-contract.spec.mjs` 遍历 31 个 URL；英寸/毫米结果核算、SVG 图元核验、下载 CSV 每行及表头与计算模型一致。并不等于检查了每个可能输入 |
| 42 HTML 静态页、6 分类、152 研究关键词 | PASS（静态工程） | `tests/validate_static.py`、`src/tool-intents.json`；152 是上传 Semrush 前 400 行样本筛出的 KD≤29 研究词，不是预测新站排名或真实流量 |
| 多断点响应与打印 A4/Letter | PASS（自动化） | Playwright 320/360/390/768/1024/1440 部分路由，特殊打印长表 PDF 自动审核；真实打印机与 Safari iOS **NOT RUN** |
| 屏幕阅读/Tab 与视觉布局顺序 | FIX IN THIS PR — VERIFY CI | `src/app.mjs` 根据 1220px 断点同步真实 DOM 阅读顺序，`tests/e2e/final-acceptance.spec.mjs` 覆盖 320–1440px、Tab 和调整视口后焦点恢复 |
| 依赖可复现构建 | FIX IN THIS PR — VERIFY CI | 新增 `package-lock.json`（npm 官方 1.56.1 发布 tarball integrity）并改 `npm install` 为 `npm ci`；须在 Actions 干净运行器验证 |
| 上线索引、域名、GSC、广告收益 | NOT RUN / BLOCKED | 无自有正式域名；Cloudflare Pages 预览必须继续 `noindex,nofollow,noarchive`，`robots.txt Disallow: /`。正式 canonical/sitemap/index 切换、GSC、AdSense 仅正式发布阶段执行 |
| 实体尺寸/纸张/安全 | NOT RUN · OUT OF SOFTWARE QA SCOPE | `FIELD-ACCEPTANCE-CHECKLIST.md` 保留为空白自愿实测模板；用户已豁免其作为纯参考网站的软件发布阻断项，仍不可声称 1:1 或结构安全认证 |

## 31 项逐一验收（V3 计划范围 vs 当前实现）

表中“PASS”只指基线主分支 #705 指定自动化场景，不是“所有现实木工情况经过专业审核”。纯数字换算的物理审核标 N/A；实体类须按风险实际验收。

### P0（9 个）

| URL | 软件计算与浏览器核验 | 真实物理/专业复核 | 正式发布 |
|---|---|---|---|
| `/stud-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/framing-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/deck-board-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/baluster-spacing-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/rafter-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/crown-molding-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/soffit-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/kerf-bending-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/wainscoting-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |

### V3 计划 P1（17 个）

| URL | 软件计算与浏览器核验 | 真实物理/专业复核 | 正式发布 |
|---|---|---|---|
| `/stair-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/rise-run-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | N/A（纯换算或报价；报价来源仍须用户确认） | BLOCKED（预览站 noindex） |
| `/deck-material-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/segmented-bowl-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/roof-pitch-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | N/A（纯换算或报价；报价来源仍须用户确认） | BLOCKED（预览站 noindex） |
| `/equal-spacing-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/hip-rafter-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/hip-roof-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/wall-stud-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/shelf-spacing-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/gable-roof-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/square-layout-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/diagonal-brace-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/hole-spacing-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/stair-stringer-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/roof-sheathing-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |
| `/fence-post-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex） |

### V3 原 P2（5 个，后来在仓库提升到 P1）

| URL | 软件计算与浏览器核验 | 真实物理/专业复核 | 正式发布 |
|---|---|---|---|
| `/spiral-staircase-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex；原 V3 P2 待专门批准） |
| `/gambrel-roof-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex；原 V3 P2 待专门批准） |
| `/lumber-price-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | N/A（纯换算或报价；报价来源仍须用户确认） | BLOCKED（预览站 noindex；原 V3 P2 待专门批准） |
| `/fence-picket-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex；原 V3 P2 待专门批准） |
| `/stave-calculator/` | PASS（既有 CI #705：默认黄金值、异常/单位、屏幕/SVG/CSV） | NOT RUN（实体尺寸、材料/试切） | BLOCKED（预览站 noindex；原 V3 P2 待专门批准） |

## 2026-11-07 Cloudflare 全站真实预览复核（新增）

实际访问 `https://woodworking-calculator.pages.dev/`，逐一取回 42 个预览 URL 的服务器可读 HTML（不是只读构建源码）：**1 首页 + 31 个工具页 + 6 个分类页 + 4 个政策页**。全部可检索到一个 H1、各自标题及 `noindex,nofollow,noarchive`；31 个工具页含实际输入表单、可读公式正文。导航分类分别为 `/framing/`、`/decks-and-railings/`、`/roof-and-stairs/`、`/interior-finish/`、`/woodworking/`、`/materials/`。任意不存在的测试路径实际返回 HTTP **404**，`/sitemap.xml` 在预览环境返回 HTTP **404**，`/robots.txt` 实际为 `Disallow: /`。取回新版 `app.mjs`、`style.css`、`calcs.mjs` 和两份独立工具 JSON，未见资源提取错误。

**严格边界：** 本次是线上 HTML/资源取回及基本元数据检查，不是对 31 个线上页面逐一进行触屏、JavaScript 点击或实体打印的人工操作。浏览器交互、CSV 和图纸一致性仍引用主分支 CI #715；用户设备与专业物理施工仍是 NOT RUN。正式上线所需 canonical/sitemap/index 是离线构建模拟，不是已购域名的真实爬取与收录。

**本次发现的实际发布风险：** `/materials/` 仅有原 V3 P2 `lumber-price-calculator`。修复前，当 `RELEASE_APPROVED=1` 且 P2 未批准时，`/materials/` 仍可能被标记 index 并加入 sitemap，成为没有可索引子工具的分类页。本次修复：仅当分类内至少有一个独立通过搜索发布审批的工具，才生成该分类的 canonical/JSON-LD/index/sitemap 条目。**预览仍保持原 42 页均 noindex**；这项正式发布修复须由新 PR/head + 合并 main 的 CI 重新验证。

## 发布前唯一保留的外部动作

1. **专业/实体抽查（NOT RUN）：** 由有设备和木料的人执行 `FIELD-ACCEPTANCE-CHECKLIST.md`。先覆盖 P0 九项中的典型尺寸与首尾边界、椽木鸟嘴/角线正负方向、墙体洞口、露台末排裁宽；再覆盖高复杂度楼梯、屋顶、钻孔、分段木碗和原 P2 的加工条件。若出现失败，提供工具 URL、输入、CSV 行和实际测量记录，再修复。
2. **真实浏览器与手机验收（NOT RUN）：** Windows Chrome、实际 iOS Safari、TalkBack/VoiceOver 或 NVDA 以及实际打印机验收。GitHub Linux WebKit/Firefox smoke 不能替代真实 Apple/Android 设备和辅助技术。
3. **正式发布（BLOCKED，由域名决定）：** 先确定自有域名和审查结果，才启用生产 canonical/sitemap/index；之后配置 GSC、验证 200/404/robots/结构化数据和实际抓取。未取得搜索表现前，不宣布 SEO 收录或变现完成。
4. **不再追加功能：** 新想法记录到单独 backlog。只修复可复现的 P0/P1 公式、SVG/CSV 不一致、表单与触屏阻断、正式发布门禁缺陷。

## 本轮缺陷处置与验收口径

- **缺陷 A（键盘/阅读顺序不一致）：** 原 HTML DOM 为“输入 → 图纸 → 结果”，但 ≤1220px 视觉格为“输入 → 结果 → 图纸”。本轮同步 DOM 实际顺序，并在宽屏恢复“输入 → 图纸 → 结果”，保留原有计算模型及所有按钮事件。
- **缺陷 D（Letter 工作表尾部安全说明被裁切）：** 主分支既有 A4/Letter 测试在本轮更严格验收中暴露：楼梯侧梁 Letter PDF 第 1 页近乎空白、最后的 Worksheet assumptions 页未生成。已核查 CI 实际 PDF，修复打印大面板 `overflow:hidden` 与 `break-inside:avoid` 导致的分页问题，并增加拒绝近空白首页的回归检查。须等待重新生成的 Letter/A4 PDF 专项审计 PASS 才算关闭。
- **缺陷 C（原 V3 P2 被提前索引风险）：** 五个原 P2 已转为可用 P1，但之前只要正式域名启用索引，它们就会自动进入 sitemap。新增独立的 `RELEASE_V3_P2_APPROVED` 发布门槛；CI 使用离线示例域名同时验证 26 页默认开放与显式批准后 31 页开放。任何预览环境仍然一律 noindex。
- **缺陷 B（构建不确定性）：** 方案第 20 节明确要求锁文件；此前无 `package-lock.json`，CI 每次无锁 `npm install`。本轮固定间接依赖及完整 SHA-512 校验值，由 `npm ci` 强制校验。
- **结论与状态更新：** 只有 PR-head 与合并 main 的整套 GitHub Actions CI **均通过**才将这两项视为 PASS；若失败，必须修复并重测。**不存在“自动化全部通过 = 工程现场已经验收”的等号。**

## 判定规则

- **PASS:** 有明确可追溯的已执行测试；只覆盖所列范围。
- **FAIL:** 已执行且失败，需修复再验收。
- **NOT RUN:** 没有实际执行记录，绝不冒称 PASS。
- **N/A:** 不适用于该类任务。
- **BLOCKED:** 有已知前置条件（正式域名、人工试切等），不能提前推生产。
