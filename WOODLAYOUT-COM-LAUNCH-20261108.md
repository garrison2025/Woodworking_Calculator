# WoodLayout.com — 正式域名上线交接与验收清单（2026-11-08）

## 真实状态与边界

- **用户提供**：正式域名 `woodlayout.com` 已购买，已绑定到 `cloudflare.com`；正式联系邮箱为 `contact@woodlayout.com`。
- **代码已准备**：31 个工具、6 个分类、42 个独立页面；静态网页、导出、V5 UI、SEO 生产门禁，以及联系邮箱与邮件隐私披露。
- **尚无独立线上证据**：域名解析成功、Cloudflare Pages 项目 **Custom Domains = Active**、HTTPS 证书、邮件收发、带正确 Canonical 的 42 个上线页面、正式 sitemap、旧域名跳转、Search Console 收录。仅将域名添加到 Cloudflare DNS zone 并不能证明这些项目已完成。
- **2026-11-08 最新索引授权**：用户已明确要求直接通过代码解除 `noindex`。现在仅在 **Cloudflare Pages 生产分支 main** 自动使用 `https://woodlayout.com` 并生成 `index,follow`、Canonical、结构化数据、正式 robots 与 42 URL sitemap；**无需手动设置 `SITE_URL` 或 `RELEASE_APPROVED`**（生产 main 会覆盖这两个旧配置值）。PR/预览分支继续 noindex；旧 pages.dev 主机保留 host-scoped HTTP noindex。不会自动完成 Cloudflare 账户级 301 重定向、GSC 提交或搜索收录。
- **风险边界**：网站仍是几何尺寸/排布参考工具，不代表结构强度、法规认证、实体 1:1 打印或实物试切已通过。用户此前豁免了这些项目作为软件上线门槛，但不得写成已实测。

## Cloudflare 控制台必须完成的步骤

1. 进入 Cloudflare → **Workers & Pages → woodworking-calculator → Custom domains**，核实 `woodlayout.com` 的状态是否 **Active**。如果没有出现域名，点击 **Set up a domain** 添加 `woodlayout.com`。仅在 Cloudflare 注册/托管该 zone 与 DNS 记录，不等于绑定到了 Pages 项目。
2. 在该 Pages 项目 **Settings → Builds & deployments** 核对生产分支 `main`、构建命令 `python3 build.py`、输出目录 `dist`，确认最新 GitHub 提交有对应成功的 Pages 构建记录。
3. **无需在 Settings → Environment variables 中手动填写索引配置。** 用户已经授权写入建站代码；Cloudflare Pages 默认注入的 `CF_PAGES=1` 和 `CF_PAGES_BRANCH=main` 将在本项目源码中自动生成 `woodlayout.com` 的 indexable 构建。已有的 `SITE_URL`、`RELEASE_APPROVED` 即使是旧值，也不会覆盖生产 main 的这次授权；非 main 的 Preview 仍然禁止索引。
4. 合并并部署本次修改到生产分支后，核查 Pages 构建成功。生产主域名首页需要返回 200，且 HTML 的 `meta robots` 为 `index,follow`，Canonical 指向 `https://woodlayout.com/`。
5. 通过 **Bulk Redirects** 将 `https://woodworking-calculator.pages.dev/*` **301** 至 `https://woodlayout.com/*`；启用 preserve path suffix、preserve query string 和 subpath matching，不能将所有工具的深层链接扔回首页。设置并核验 `www.woodlayout.com` → `https://woodlayout.com` 的永久跳转，保留路径与查询字符串；不要让两个主机都返回可索引 200。
6. 核实邮箱 **实际接收和发送邮件**：`contact@woodlayout.com` 的 MX、SPF、DKIM、DMARC 与邮件服务商配置与网站的 Cloudflare Pages 绑定是两个独立问题。Cloudflare DNS / Email Routing 可以辅助转发，但 DNS 绑定不证明收发可用。本站使用 `mailto:`，没有后端表单，不会在网站上接收邮件数据。

## 可执行的正式站只读验收

在已部署的 `main` 源码目录运行：

```powershell
python scripts/verify_live_launch.py --base https://woodlayout.com --mode production --pages-origin https://woodworking-calculator.pages.dev --verify-source-parity --report woodlayout-production-audit.json
```

需要同时看到：
- `status=PASS`，`failures=[]`；
- 42 个 HTML 页可访问，42 个应发布 URL 有 `index,follow` 与 `woodlayout.com` Canonical，31 个工具表单与原始配置一致；
- `https://woodlayout.com/robots.txt` 允许抓取并指向 `https://woodlayout.com/sitemap.xml`；
- Sitemap **恰好 42 个**独立 `https://woodlayout.com/...` URL；
- `pages.dev` 的首页和工具路径返回 301/308 至各自的新域名路径；
- `https://www.woodlayout.com/stud-calculator/` 也必须永久重定向到无 `www` 的同一路径；
- 未知 URL 返回实际 404，且不能携带任何错误的 Canonical 或结构化数据。

仓库另设 **手动 GitHub Actions — WoodLayout Production Audit**，在正式部署后可一键执行上面的只读 HTTP 校验并下载 JSON 报告。此工作流不会修改 Cloudflare、设置 DNS 或提交 Google。

## 索引与持续观察（仅在上面 PASS 以后）

1. 在 Google Search Console 验证 `woodlayout.com` 域名属性，并提交 `https://woodlayout.com/sitemap.xml`。
2. 逐个检查关键页面（首页、Stud、Deck Board、Framing、Rafter、各类分类）的 URL Inspection：canonical 是否自选、是否被抓取、是否排除；**提交 sitemap 不保证收录**。
3. 检查 `contact@woodlayout.com` 是否真实收到测试邮件，再用于公开商务联系。
4. 对正式域名测量 Lighthouse / CrUX、桌面与手机加载体验；真实 iOS/Android、实体打印与木材试切仍未人工实测，不应转写为 PASS。
5. Google Analytics、AdSense 等如后来增加，须在生效前更新 /privacy/ 与相应合规说明，不能沿用当前“无第三方跟踪和广告脚本”声明。

## 官方 Cloudflare 配置参考

- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/
- https://developers.cloudflare.com/pages/how-to/www-redirect/
