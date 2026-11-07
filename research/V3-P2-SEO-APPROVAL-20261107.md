# Woodworking Calculator｜原 V3 五个 P2 工具 SEO 批准记录（2026-11-07）

## 用户决定

网站所有原 V3 P2 工具已在项目后期实现并完成线上软件验收，业主于 2026-11-07 明确要求：**开放这五个工具的 SEO 收录范围**。此决定取消独立的 `RELEASE_V3_P2_APPROVED` 索引审批门禁；**不代表当前 Cloudflare Pages 预览站已获准公开收录，也不代表购买了自有域名**。

## 获批 URL 与页面任务

| URL | 当前真实 SEO 标题 / 应承接任务 | 不应夸大的范围 |
|---|---|---|
| `/spiral-staircase-calculator/` | Spiral Staircase Calculator for Tread Wedge Geometry | 不认证多转楼梯、踏步净空、护栏、结构规范 |
| `/gambrel-roof-calculator/` | Gambrel Roof Calculator with Upper and Lower Pitch | 不认证桁架承重、连接、屋面规范 |
| `/lumber-price-calculator/` | Lumber Price Calculator for Board Foot and MBF Quotes | 仅 BF/MBF 木材价格估算，不认领通用 price per thousand items 搜索意图 |
| `/fence-picket-calculator/` | Fence Picket Spacing Calculator with Cut Heights | 等距和实际直板分段高度，不认证围栏结构或法规 |
| `/stave-calculator/` | Tapered Stave Calculator for Polygon Barrel Trapezoids | 直线多边形梯形桶板，不宣称曲面桶身、完整 coopering 及实锯角度 |

材料分类 `/materials/` 也纳入获批范围。上述页面已经具有实际表单、正文说明和受测计算逻辑；不存在因原 V3 计划优先级为 P2 而继续排除的理由。历史 152 行 Semrush 数据及搜索意图风险标记保持原状，不伪称更新了搜索量或 Google 排名。

## 开放行为与强制保护

- `RELEASE_V3_P2_APPROVED` **作废，构建器不读取**。历史 Cloudflare 环境即使遗留 `RELEASE_V3_P2_APPROVED=0`，也不会误关这五个页面。
- 网站正式可索引的唯一主门禁仍是已拥有的 HTTPS 自定义域名、`SITE_URL=https://真实域名`、`RELEASE_APPROVED=1`，以及 Cloudflare 主分支。实际域名尚未购买，当前开关不能操作。
- 获批正式构建应有 **42 个 canonical / JSON-LD / sitemap URL**：主页 1、31 工具、6 分类、4 信息/政策页；**404 永久 noindex**。
- 当前 `woodworking-calculator.pages.dev` 继续 **42 页 noindex**、`robots.txt` 禁止抓取、没有 sitemap；任何 Cloudflare Preview 分支即使错配 `RELEASE_APPROVED=1` 也不可索引。
- 正式域名建立并获用户另行上线授权后，再验证 42 个 URL 的实际 HTTP、canonical、schema、sitemap、`pages.dev` 主机永久跳转，以及真实 Google Search Console。
- 这只是**软件页面的 SEO 发布范围审批**，不代表真实打印尺寸、锯切安全或建筑规范认证；现场测试已依业主决定退出软件验收门槛。

## CI 验收矩阵

1. 未授权/无自有域名：`build.py` 创建 42 个工具与内容页，所有 HTML `noindex`、无 sitemap，Cloudflare Pages 不得提前索引。
2. 离线正式发布：`SITE_URL=https://woodworking.example RELEASE_APPROVED=1 python3 build.py` 只作为本地模拟，`tests/validate_release.py` 断言 **42** 条 canonical、JSON-LD 和 sitemap 路径完全匹配。
3. 遗留开关回归：增加 `RELEASE_V3_P2_APPROVED=0` 进行同样正式发布模拟，仍应全部 **42** URL 获准。
4. Cloudflare feature/preview 分支和 `*.pages.dev` 域名强制 noindex；正式 main 模拟覆盖 42 URL；真实预览部署须经 GitHub Actions 的 `deployed-preview` 审计通过。
5. 旧版 36 页生产 SEO 模式**已经取消**。不要把仓库历史文件中 36 URL 的旧描述理解为目前的真实发布策略。

**当前状态：五工具 SEO 发布范围 APPROVED；正式自有域名索引上线 NOT RUN。**
