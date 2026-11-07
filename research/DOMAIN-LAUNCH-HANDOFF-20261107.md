# Woodworking Calculator｜正式域名上线交接（2026-11-07）

**当前客观状态：只完成软件/自动化验收和 Cloudflare Pages 预览部署，没有购买自有域名，没有开启搜索引擎收录。** 请勿把本文当作已执行的上线操作记录。当前 31 个工具、42 个页面、5 个原始 V3 P2 的独立索引门禁及最近一次成功的主分支 CI [#717](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/42337786055) 见 [最终验收记录](../FINAL-ACCEPTANCE-20261107.md)。

> **2026-11-07 SEO 范围变更（覆盖下文旧版 36/42 条双模式描述）：** 用户已批准原 V3 全部五个 P2 工具及 Materials 分类参与**未来正式自有域名**的搜索收录，`RELEASE_V3_P2_APPROVED` 已废弃；现在真实域名上线发布默认包含 **42/42 URL**。见[用户批准记录](V3-P2-SEO-APPROVAL-20261107.md)。当前 `pages.dev` 预览保持 `noindex`，域名未购买，正式上线授权仍未执行。

> **2026-11-07 业主范围变更：** 已选择[仅线上软件验收](ONLINE-ONLY-SOFTWARE-ACCEPTANCE-20261107.md)，不再要求业主本人完成打印尺测、木料试切或 iOS/Android 真机测试。这三类项目仍为 **NOT RUN**，但不再是本参考工具站的**软件发布阻断项**；不可据此声称实体精度/施工安全认证。最新主分支线上核验是 [CI #42354449839](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/42354449839)，完整通过；**域名购买与正式索引仍然未执行**。

## 不能混为一谈的三个状态

| 项目 | 状态 | 说明 |
|---|---|---|
| 软件开发与自动化验收 | PASS（限 CI 覆盖） | 31 工具/42 静态页面、浏览器/PDF/两种索引配置已有独立 CI 证据 |
| 实体木工、打印和硬件设备 | NOT RUN · 已豁免软件验收阻断 | [现场验收记录](../FIELD-ACCEPTANCE-CHECKLIST.md) 仅供自愿实地检查；材料、结构、承载/法规审核不属于软件认证 |
| 自有域名、真实 GSC、索引与广告 | NOT RUN | 目前只有 `https://woodworking-calculator.pages.dev/`，所有预览页 `noindex,nofollow,noarchive`；无搜索流量/广告收益证据 |

## 上线先决条件（人工操作，脚本不能代替）

1. **确认线上软件用途与验收证据**：依据[线上软件验收记录](ONLINE-ONLY-SOFTWARE-ACCEPTANCE-20261107.md)与成功的主分支 CI、Cloudflare 源码一致性审计，作为几何计算/材料估算参考工具的网站软件发布条件。**不强制业主执行实体 A4/Letter 尺测、木料试切或真机人工验收**；这些保留 NOT RUN，不构成 1:1 模板、施工安全或法规符合性认证。
2. **购买自有 HTTPS 域名**：Cloudflare Dashboard → Workers & Pages → 项目 `woodworking-calculator` → **Custom domains → Set up a domain**。如果买根域名（如 `example.com`），按 Cloudflare 的官方流程把它添加为 Cloudflare zone 并配置域名服务器；自定义子域名遵循官方 DNS/CNAME 流程。域名未买就不要填写假 `SITE_URL`。
3. **先绑定域名，暂不开放索引**：保持 `RELEASE_APPROVED` 缺失或为 `0`，确定自有域名实际返回预览版 `noindex`。在 Cloudflare Pages 的 **Production** 环境单独填写 `SITE_URL=https://真实域名`；Preview 环境不要设置 `RELEASE_APPROVED=1`。源码还会在 `CF_PAGES=1` 且 `CF_PAGES_BRANCH!=main` 时强制关闭索引，防止误拷贝生产环境变量。
4. **正式 SEO 发布范围已确定为 42 个 URL**：用户已明确批准全部五个原 V3 P2 工具，额外 `RELEASE_V3_P2_APPROVED` 开关已移除。未来仅在用户购买并接入自有域名、明确授权正式发布、软件 CI/实站检查通过后，在 Production 环境填写 `SITE_URL=https://真实域名` 和 `RELEASE_APPROVED=1`，一次性索引 **31 个工具 + 6 个分类（含 Materials）+ 首页 + 4 个政策页 = 42 个 canonical/sitemap URL**。目前不要设置正式发布开关。
5. **处理生产 Pages 别名**：Cloudflare 说明，当自有域名绑定后，`woodworking-calculator.pages.dev` 仍可能提供和自有域名相同的产物。用 Cloudflare **Bulk Redirects** 将这个旧域名以 **301** 永久重定向到 `https://真实域名`，设置 *Subpath matching*、*Preserve path suffix*、*Preserve query string*。如同时使用 `www`，按选择的首选主域设置相应重定向。不要假设只有 canonical 就完成去重。
6. **重新部署 production main**：确认实际 Git SHA 与成功的 Cloudflare 部署日志；如 CI 红灯，不批准搜索索引。`CF_PAGES_BRANCH` 必须是 `main` 才会有可索引产物，其他 Pages 分支始终 fail closed。
7. **运行下面的只读 HTTP 审核并保存 JSON 记录**。全部 PASS 后才去 Google Search Console 添加/验证域名资产并提交真实 `sitemap.xml`，随后按上线后第 2、4、8 周检查 GSC 收录、展现、点击和查询，不虚构流量或收益。

官方步骤来源：[Cloudflare Pages 自定义域名](https://developers.cloudflare.com/pages/configuration/custom-domains/)、[Pages 构建环境变量](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[Pages 预览部署与 noindex](https://developers.cloudflare.com/pages/configuration/preview-deployments/)、[Pages.dev → 自有域名重定向](https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/)、[www → 根域名](https://developers.cloudflare.com/pages/how-to/www-redirect/)。

## Windows PowerShell 可运行的 HTTP 验收

当前无自有域名，能执行的是**预览检查**（只有 HTML/HTTP 验证，不会触发实际浏览器点击、手机辅助技术或实体打印）：

~~~powershell
git clone https://github.com/garrison2025/Woodworking_Calculator.git
cd Woodworking_Calculator
python scripts/verify_live_launch.py --base https://woodworking-calculator.pages.dev --mode preview --verify-source-parity --report preview-audit.json
~~~

只有真正买了域名并按以上步骤完成 Pages 域名、生产索引和 Bulk Redirect 配置，才运行**正式域名检查**（将占位符替换为真正购买的地址）：

~~~powershell
python scripts/verify_live_launch.py --base https://YOUR-OWN-DOMAIN.com --mode production --pages-origin https://woodworking-calculator.pages.dev --verify-source-parity --report production-audit.json
~~~

原 V3 五个 P2 已获批准，**不再使用** `--approve-v3-p2` 参数；未来正式域名审核默认检查 42 个 URL。脚本会检查：

- **所有 42 个实际页面**是否 HTTP 200、有唯一 H1、标题和 description；31 个工具都有表单；
- **索引条件**：当前预览全部 noindex；未来正式自有域名上线时 42 个已批准 URL 均须有绝对 canonical、匹配 URL 与类型的 JSON-LD，并出现在生产 sitemap；
- **31 个独立配置 JSON**的 URL 与 slug、JS/CSS/favicons 等资源是否能正常 GET；
- **预览环境**禁止抓取、sitemap 必须 404；**正式环境** sitemap URL 集合与获准索引页完全一致；
- **不存在路径**实际 HTTP 404；**生产旧 pages.dev 别名**主页与一个工具路径必须真实返回指向自有域名对应路径的 301/308。

附加的 `--verify-source-parity` 会用**当前合并后的 GitHub 主分支源码**核验线上 31 个表单字段、31 份完整 JSON 配置和 11 个关键 JS/CSS/注册表资源。如果 Cloudflare 仍部署旧版本，即使每个 URL 都返回 200，也会 FAIL。主分支 GitHub Actions 新增独立 `deployed-preview` 作业，`verify` 全套通过后再重试真实 Pages 状态，并上传 `cloudflare-live-preview-audit` JSON；该报告与离线 CI 是不同证据，不能混称。

退出码 **0 = PASS，1 = FAIL**；`--report` 保存 JSON 证据。报告明确标明 `physical_measurement=NOT RUN`、`device_screen_reader_test=NOT RUN` 与 `gsc_indexing=NOT RUN`，不代表真实 GSC 索引或工程安全已经验证。

## 失败回滚

- **功能、数据或审核 FAIL**：不要打开广告和向 GSC 提交 sitemap。先检查 GitHub Actions 与 Cloudflare 实际部署 SHA，明确复现 URL 和输入，再修复回归。
- **域名已经接入但索引设置不对**：将 Production `RELEASE_APPROVED=0` 并**重新部署**，再核验 HTTP noindex/robots；原先被搜索引擎抓取的 URL 不会因改设置而立即消失。
- **重定向 FAIL**：先在 Cloudflare Bulk Redirects 修正规则，再按首选域名的 HTTPS 路径重试。不要在 GitHub 静态页面的 `_redirects` 文件中添加无主机条件的通配跳转，避免自有域名发生循环。
- **真实物理审核 FAIL**：停用该批材料加工决策、留存具体数据与验收记录；不会因为浏览器自动测试 PASS 而自动重新批准。
