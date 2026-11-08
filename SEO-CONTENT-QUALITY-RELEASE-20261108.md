# WoodLayout.com — 2026-11-08 SEO 内容与技术结构优化记录

> 记录为源代码改动范围、质量边界及正式上线后的核验方法。CI/Cloudflare/GSC 的实际结果以运行日志、HTTP 响应和 Google 产品数据为准；本文不伪造 PageSpeed 得分、搜索收录或收益。

## 本轮改动

1. **首页可读的主要主题**：H1 明确为 free woodworking calculators，并保留 WoodLayout 原有字体、配色及绘图动效。原品牌价值说明移动到正文，而不靠虚词覆盖标题主题。
2. **六个独立且有任务价值的分类页**：`framing`, `decks`, `roof`, `interior`, `wood`, `materials` 分别提供简明适用任务、具体工具选择说明、数学可复算示例和真实限制。所有工具链接指向原有的对应类别路由，使用真实站内工具的可用能力；没有生成关键词薄页或声称获得结构/施工专业认证。
3. **Materials 重点补全**：明确 BF = 厚(英寸)×宽(英寸)×长(英寸)/144；8 BF = 0.008 MBF，用户自填每 BF 的价格而非声称拥有实时木料行情。现有分类只有 Lumber Price 一款工具，绝不虚构其它工具。
4. **Schema 语义**：`WebSite` 仅用于首页；工具对应 `WebApplication`；分类对应 `CollectionPage` + `ItemList`；分类/工具附加真实导航对应的 `BreadcrumbList`；About/Contact 各自使用准确的页面类型。JSON-LD 是描述性元数据，不保证任何搜索富摘要。
5. **分享预览**：正式主域名的已索引页面增加 `og:url`, 真实同站的 1200×630 PNG `og:image`, 宽高/替代说明和 `twitter:card`。图像由标准库构建脚本输出，没有第三方 API 或外链依赖。PR/Preview 分支延续 `noindex` 保护。
6. **公开的可靠性边界**：About 清楚说明本地计算、自动化测试覆盖范围、人工未验证的打印及实际木工切割，并提供 `contact@woodlayout.com` 和可复算反馈途径。
7. **自动化 SEO 校验**：真实 42 个 URL、六个唯一分类指南、OG PNG 格式/尺寸、合法 schema 类型、面包屑、静态资源重量上限；保持现有单元、Chromium/Firefox/WebKit、CSV/SVG/PDF 和旧 SEO 生产/预览门禁测试。

## 与用户原始研究数据的关系

- 仍保持 **31 计算器 / 6 分类 / 42 页面**，不创建仅为关键词覆盖的重复网址。
- 原 152 条 Semrush 研究数据及 22 条搜索意图偏差警示不修改；任何历史搜索量/KD/CPC 不等于当前收录、排名和实际流量。
- 6 分类页的示例是手工可重算的几何计算，不能证明实体材料的品质、结构安全、法规或实物切割。

## 发布后应继续验证的外部项目

1. **Google Search Console（需要域名账户访问）**：验证 Domain `woodlayout.com`，提交 `https://woodlayout.com/sitemap.xml`，以 URL Inspection 查看 Google 选取的 canonical、已编入索引状态，持续跟踪 Performance → 查询/网页/国家/展示次数/CTR。提交 Sitemap 不保证收录。
2. **现场性能（暂无可引用的 CrUX 指标）**：用 PageSpeed Insights 对首页、`/deck-board-calculator/`、`/stair-stringer-calculator/` 和 `/materials/` 各跑 mobile+desktop；记录测试日期、LCP、INP、CLS、Lighthouse Lab 数据。核心网页指标以真实用户数据为准，静态资源预算只防代码退化，不等于通过 CWV。
3. **旧 Pages 域名跳转（用户决定暂缓）**：`woodworking-calculator.pages.dev` 对应路径 → `woodlayout.com` 的 301/308 尚无证据。它不阻止主域名 Meta robots `index,follow`，但仍是独立的规范域名清理项目；不能假称处理完成。
4. **www 行为与邮件收发**：需要额外查验 `https://www.woodlayout.com` 的 301、`contact@woodlayout.com` 实际邮箱投递/回复及相关 DNS 邮件记录。
5. **后续关键词优化**：先使用实际 GSC 点击、展示和搜索意图证据确定补充内容优先级，不把所有 152 条历史词塞到每个页面标题。
