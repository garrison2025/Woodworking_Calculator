# Woodworking Calculator｜预上线未完成事项的执行交接（2026-11-07）

> **此表不是全量上线放行声明。** 31 个工具/42 个页面的软件回归可自动完成；实物木工、实体打印和设备辅助技术验收必须由实际操作者独立完成。正式域名尚未购买，不能伪造 Cloudflare DNS、GSC 收录或 P2 审批。

## 本轮可独立执行的改进

1. 新增**按需手动触发**的 GitHub Actions `macos-webkit-qa.yml`（macOS 15 + Playwright WebKit），执行跨浏览器几何、导出、键盘访问和 31 页 320/390/768px 响应性测试。PR #30 开发期曾在 macOS 托管运行器实测通过；因为 Mac CI 可能额外计费，它不在每次 push/PR 上重复运行。常规 `verify` 通过后会触发 `deployed-preview` 实站版本与 noindex 门禁。**这仍不是 Apple Safari 品牌浏览器、iPhone 真机或 VoiceOver 真正朗读测试**。
2. 新增 `scripts/export_keyword_review_register.py` 和 [152 条单词可追溯审查表](keyword-decision-register-152.csv)。每条保留原始美国估算 Volume/KD/CPC、历史对手页面、原始归属、疑点决定、允许文案范围、候选目标，并显式标记 **`NOT VERIFIED (US GEO)`**。152 行 = **22 条已标注风险/边界的历史疑点 + 30 条非重叠主关键词 + 100 条尚未经逐词独立验证的次级词**；第 31 个主关键词与疑点词重合（`price per thousand calculator`）。
3. 原 152 行来源文件保持原样；新脚本 `--check` 进入 CI，来源或审查状态漂移必须 FAIL，不能在页面上悄悄认领未经审查的长尾词。
4. 配备**独立 A4 和 US Letter 矢量标尺校准 PDF**以及空白纸面和木料实测记录（本次 ChatGPT 对话附件）；其 100 mm 与 1.000 in 线段长度在 PDF 向量单位上可检验，**打印机真实比例不能远程测量**。站内浏览器原有 100mm/1in 标尺和 CI 导出 PDF 继续保留。

## 仍不可代替的人工作业：定义、合格证据、阻断

| 级别 | 事项 | 完成标准 | 目前状态 | 当前真正需要谁 |
|---|---|---|---|---|
| P0 | A4/Letter 实体打印 | 用匹配纸张、100%/Actual size 打印；实际尺测 **100mm ∈ [99.5,100.5]mm** 与 **1in ∈ [0.995,1.005]in**；核对纸面最后一行与 CSV；记录打印机、签名 | **NOT RUN，PDF 已制作，硬件读数没有** | 有打印机和实体尺的人 |
| P0 | 木料尺寸、试切、真实荷载安全 | 按 [现场验收](../FIELD-ACCEPTANCE-CHECKLIST.md) 记录真实木材批次、缺陷、基准面、原始输入、CSV、实际测量、先定容差和独立决策，必要时专业工程审查 | **NOT RUN，不接受自动代签** | 有木工现场与专业能力的人 |
| P0 | `.com` 域名、DNS、实际发布 | 用户先决定并购买**确属自己**的域名；Cloudflare Pages 绑定证书生效；设置 `SITE_URL=https://OWNED-DOMAIN`、`RELEASE_APPROVED=1`（仅经用户上线授权）；再核对 pages.dev 301、canonical、robots、sitemap | **BLOCKED：无域名、无购买凭据、未获特定域名发布授权** | 购买者/账户管理员 |
| P1 | iOS Safari、Android Chrome、VoiceOver/TalkBack/NVDA | **真实设备与辅助技术**检查所有重要交互：独立朗读标签/报错、横向表格、键盘顺序、打印/导出、是否需要拖动等；记录机型与系统版本、录屏/截图 | **NOT RUN：自动化仿真不能代替** | 真机用户/测试人员 |
| P1 | GSC 实际收录、展示、查询与点击 | 正式索引开放后 GSC 验证财产权；提交 sitemap；等实际 Google 抓取结果及查询数据，记录日期 | **BLOCKED：预览 noindex，尚未上线** | 已持有域名并登录 GSC 的用户 |
| P1 | 最新美国 SERP 和 KD/Volume/CPC | 对每条来源词用可复核的美国指定地区 SERP 搜索结果和当期 Semrush/Ahrefs 原始导出核对工具意图、数据日期、前 10/20 名；不能用 web 公共样本当作全量验证 | **仍未完成 152 条 US GEO SERP 和最新付费指标**；来源历史值保留、全部打状态 | 可访问目标地区 SERP 与商业数据平台的人 |
| P2 | 原 V3 五个 P2 的正式 SEO 收录 | 用户确认风险和编辑范围后，单独明确批准 `RELEASE_V3_P2_APPROVED=1`；先完成域名、内容、真实测试，再核对索引列表（目前默认生产模拟只开放 36，含 P2 时模拟为 42） | **功能 IMPLEMENTED；SEO APPROVAL NOT GRANTED** | 站长/专业审核人 |

### 两类工作不可混同

- **软件工作**：GitHub CI 测试、macOS WebKit 自动化、Cloudflare deployed-source parity、152 关键词来源与状态一致性。可以自动检查并在日志留证。
- **现实工作**：锯切安全、纸面标尺、用户自己的域名购买、GSC 的真实数据、Apple/Android 辅助技术使用。没有提供实测记录或受权动作时，必须诚实标注 NOT RUN 或 BLOCKED。

## 依次执行的最短人工清单

1. 下载本轮 A4/Letter 纸面校准包，选择和纸盘一样的纸型，严格 100% 实际尺寸打印，记录两条标尺的读数。
2. 如要从预览变为正式可索引站点，先给出**已购买的** `.com` 域名、已授权 Cloudflare 接入及明确“批准上线”指令。按 [上线交接](DOMAIN-LAUNCH-HANDOFF-20261107.md) 走前后对照与主机 301。
3. 有设备时完成 iOS Safari / Android / VoiceOver / TalkBack 的实际检查；有木工条件时做独立试切。没有数据就保持 NOT RUN。
4. 站点正式索引后再登录 GSC 看结果；给出 Semrush/Ahrefs 新日期的 152 行导出才能独立更新 KD/Volume/CPC，不把 2026-11-04 数据称作“实时”。

**无须新增 152 个 SEO 页面；未经独立验证的词不会自动写入元标题、内部链接或 sitemap。**
