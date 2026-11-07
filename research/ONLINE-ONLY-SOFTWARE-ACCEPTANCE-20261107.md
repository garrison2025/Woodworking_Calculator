# Woodworking Calculator｜远程软件验收结案口径（2026-11-07）

> **同日后续用户授权补充：** 用户已另外批准五个原始 V3 P2 工具及 Materials 分类成为未来正式 HTTPS 自有域名的索引目标，生产范围扩大为 **42/42**。原“尚未批准 P2 SEO”的历史句子以[SEO 批准记录](V3-P2-SEO-APPROVAL-20261107.md)为准；**未开启 Pages 预览收录或购买域名**，物理/真机验收豁免决定不变。

## 业主最新决定与验收范围

2026-11-07，用户明确决定：**不再要求其本人执行实体打印尺测、木料试切及 iOS/Android 真机与辅助技术人工操作；以现有线上及自动化测试作为网站软件验收依据**。

本文件是 **软件验收范围调整**，不是对实体打印精度、实木加工安全、任何结构承重、当地建筑规范或屏幕阅读器真实设备兼容性的认证。所有原始人工测量项目在历史记录中继续保持 **NOT RUN**，并标记 **WAIVED AS SOFTWARE RELEASE GATE / OUT OF SCOPE**，绝不填写虚构测量值、签名或设备型号。

本决定不涉及域名购买、Cloudflare 账户授权、正式索引许可、Google Search Console 数据、广告收益，且**没有批准**原 V3 五个 P2 工具的 SEO 收录。

## 可追溯的远程验收证据

- 源码：`main` 合并提交 `61a367c478ab6b3483376f4bcb86262c9684bcbd`（PR #31）。
- 完整 GitHub Actions：[Verify Woodworking Tools #42354449839](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/42354449839)，`verify` 与 `deployed-preview` 均为 **success**。
- `verify`：31 工具纯函数与单元/边界回归、42 静态路由、152 历史研究词一致性、Chromium 交互/导出/移动断点测试、540 行及特殊 A4/Letter PDF 数字内容审计、Firefox/Linux WebKit 冒烟、两种 P2 索引状态和预览分支的离线 SEO 门禁。
- `deployed-preview`：对真实 `https://woodworking-calculator.pages.dev/` 的 **42 个 HTML 页面、31 个表单及配置、11 个关键源文件**进行 HTTP 与源码对比；共 **73 项源码一致性检查**，结果 `PASS`，`failures=[]`，`indexable_routes_expected=0`。
- 此证据没有包括“在真实 Cloudflare 页面上完整逐次点击全部 31 个工具”，实际浏览器交互由 CI 的构建站完成、而现网由 HTTP/源码一致性保证。两种证据须分开陈述。

| 验收项 | 本次决策状态 | 精确解释 |
|---|---|---|
| 31 工具算法、SVG/CSV、失效输入 | **PASS（自动化覆盖范围）** | 测试样本与浏览器回归，不代表所有可能的实木加工条件 |
| 数字 PDF、A4/Letter、矢量校准条 | **PASS（数字文件）** | PDF 与页内容自动审计，不是纸面尺测 |
| 浏览器响应布局、键盘、移动模拟 | **PASS（自动化覆盖范围）** | 包含 Chromium/Firefox/Linux WebKit，以及此前 macOS WebKit 运行记录；不代表实际 iOS Safari/VoiceOver/TalkBack |
| Cloudflare 实站 HTTP 与源码版本 | **PASS** | 上述成功的主分支独立审计 |
| 真实打印机纸面精度 | **NOT RUN · 软件验收范围外** | 不再要求用户操作；不能承诺所有打印机上的 1:1 切割比例 |
| 木料试切、结构/安全/法规审查 | **NOT RUN · 软件验收范围外** | 不能当作承重计算器、工程签发文件或可直接上锯的模板 |
| iOS/Android 真机及辅助技术人工朗读 | **NOT RUN · 软件验收范围外** | 线上模拟测试替代本项目的*软件验收门槛*，而不等于真实设备验证 |
| 自有 `.com`、生产 SEO、GSC | **BLOCKED / NOT RUN** | 需用户未来决定购买、绑定和明确批准；当前预览为 `noindex` |
| 152 词最新 US SERP、KD/Volume/CPC | **NOT VERIFIED** | 历史 Semrush 样本已记录；当前 US GEO 与商业平台实时指标未验证 |
| 原 V3 五个 P2 的 SEO 发布 | **NOT APPROVED** | 功能可预览，生产索引仍需单独批准 |

## 软件用途声明与剩余阻断

- 定位是 **free browser-only geometry, dimension layout and materials-estimation reference**；界面图为比例示意，CSV/PDF 是参考结果，均**不是经过现实测量的 1:1 锯切模板或工程核准图纸**。
- 无实体校准数据时，不可在任何 UI、元描述、资料或销售文案中使用 `certified 1:1`、`field verified`、`structurally safe`、`code approved` 等承诺。真实工匠选择动用工具或处理木料时，需要独立核对测量基准、材料和操作安全，这属于使用情境而非软件验收签字。
- 用户不必为当前软件项目购买纸张、打印机、木材或手机、填写 `FIELD-ACCEPTANCE-CHECKLIST.md`。该文件保留为**自愿实地测试模板**，如未来扩展为实体施工/精密模板业务才重新启用。
- **正式网站上线仍未执行**：不触碰 `RELEASE_APPROVED`、`SITE_URL`、Cloudflare DNS、现网 `robots.txt` 或预览的禁止索引状态。域名和后续 Search Console 归用户将来授权。
- 未来发布仅需满足软件 CI/实站审核、用户批准的**真实自有域名**及具体索引发布命令；原 V3 P2 的 `RELEASE_V3_P2_APPROVED` 默认关闭。参见 [域名交接](DOMAIN-LAUNCH-HANDOFF-20261107.md)。

## 结案判定

**SOFTWARE-ONLY ACCEPTANCE: PASS（有以上 CI 与 Cloudflare HTTP 证据，限定软件用途）；PHYSICAL/REAL DEVICE ACCEPTANCE: NOT RUN, WAIVED AS SOFTWARE RELEASE GATES；CUSTOM-DOMAIN / SEARCH INDEX LAUNCH: NOT RUN。**

不应把前两个结论合并成“已完成全部实物和真机验收”，也不应把预览部署称为正式 SEO 上线。
