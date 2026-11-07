# Woodworking Calculator｜31 个功能与 152 个关键词最终搜索意图核验（2026-11-07）

> **本文件是一次冻结范围的关键词/功能真实性审查，不是网站已获得 Google 收录、流量、排名或全部 152 个关键词都能排名的声明。** 范围以 2026-11-04 用户 Semrush Blocklayer 前 400 条数据筛出的 152 条 KD≤29 词、当前 `src/tools.json` 及 `src/tool-intents.json` 为准。外部公开搜索结果只对少量歧义词进行定性抽查，**不是地理定位美国的逐词 SERP Top10/20 实测**。

**2026-11-07 补充（后续实施）：** 已在原 `/deck-material-calculator/` 追加“用户提供最大 OC 的均匀中心线排布”可选模式。该模式复用同一工具页、图纸、CSV 和计量表，不新增 URL；之前 12 条独立功能候选中，2 条 Joist Spacing 现在属于**限定几何能力已有、仍不认领结构规范/宽泛搜索意图**。CI 需以该功能分支及合并主分支的实际结果为准。

## 一、结论与数据边界

- **功能软件建设**：31/31 个计算器路由已实现，其中 V3 原计划 9 P0 + 17 P1 + 5 个后续实现的原始 P2。31 个功能都有独立工具页，六个分类、主页、四个政策说明页共 42 个静态 HTML；现有 main 自动化验收 [CI #719](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/42339894355) 通过。实物试切、物理打印及人工专业审核仍是 NOT RUN。
- **关键词研究映射**：152/152 条原始去重研究词、美国搜索量与 KD/CPC 估计值已保存，`target_route` 均指向真实存在的 31 个工具 URL；其中 **75 条历史 CPC > 0**、KD 最大值为 29。152 条历史 Volume 单纯相加为 **108,930 次/月**，由于重复查询意图和平台估算，**不能视为独立搜索人群、新站访问或广告收入**。
- **31 个主搜索词的功能核对**：21 个与当前页面任务口径相符；9 个有更广泛解释，页面应继续使用限定用途的 `title/H1/Not covered`；1 个（`price per thousand calculator`）有泛化歧义，应暂缓把无修饰词当作精确匹配目标。以上为 **工程语义审核，不是逐词 SERP 验证**。
- **22 条具体意图偏差**：1 条已纠正到真正支持的现有工具、2 条需要继续核查搜索意图、10 条需独立功能/专业约束、2 条已有可选的几何排布模式但未验证宽泛 SERP、3 条是教程/指南意图、4 条不得作为本站直接 SEO 目标。22 条原始记录的历史搜索量相加 **7,420 次/月**，仍不代表可实际获得流量。这些疑点中 **21 条未被批准成为现有页面的关键词同义词**。
- **不改变发布门槛**：正式域名尚未购买，`pages.dev` 预览全部 `noindex`。未来即使有正式域名，原 V3 的 5 个 P2 计算器及只包含原 P2 的 Materials 分类必须单独审批才可索引。默认正式发布模拟只索引 36 个 URL，原 P2 审批后可增至 42 个；当前不执行上述发布。

## 二、31 个现有工具：原始主搜索词逐页核对

以下 Volume/KD/CPC 全部是用户 2026-11-04 的 Semrush **历史估计**。搜索任务是否匹配指实际代码的输入/输出能否完成所述任务，未检验今天美国 Google 排名。

| 工具 URL | 主关键词 | 美国月量 / KD / CPC($) | 判断 | 限定与重要边界 |
|---|---|---|---|---|
| [`/stud-calculator/`](https://woodworking-calculator.pages.dev/stud-calculator/) | `stud calculator` | 3,600 / 1 / 2.49 | 词义较宽，须限定 | A straight wall stud count or framing structural approval. |
| [`/framing-calculator/`](https://woodworking-calculator.pages.dev/framing-calculator/) | `framing calculator` | 2,400 / 3 / 2.75 | 词义较宽，须限定 | An engineering-approved header span, bearing design, or permit drawing. |
| [`/deck-board-calculator/`](https://woodworking-calculator.pages.dev/deck-board-calculator/) | `deck board calculator` | 6,600 / 12 / 1.67 | 功能口径匹配 | A full deck frame, joist span, post or footing design. |
| [`/baluster-spacing-calculator/`](https://woodworking-calculator.pages.dev/baluster-spacing-calculator/) | `baluster spacing calculator` | 1,000 / 16 / 3.00 | 功能口径匹配 | Proof of local railing, child-safety, or structural-code compliance. |
| [`/rafter-calculator/`](https://woodworking-calculator.pages.dev/rafter-calculator/) | `rafter calculator` | 4,400 / 7 / 2.38 | 词义较宽，须限定 | A hip-rafter cut, engineered span, load rating, or approved roof assembly. |
| [`/crown-molding-calculator/`](https://woodworking-calculator.pages.dev/crown-molding-calculator/) | `crown molding calculator` | 390 / 9 / 0.00 | 功能口径匹配 | Proof of saw orientation, material spring angle, or a verified test cut. |
| [`/soffit-calculator/`](https://woodworking-calculator.pages.dev/soffit-calculator/) | `soffit calculator` | 1,600 / 1 / 4.28 | 功能口径匹配 | Structural design for rafter tails, fascia fastening or roof ventilation. |
| [`/kerf-bending-calculator/`](https://woodworking-calculator.pages.dev/kerf-bending-calculator/) | `kerf calculator` | 210 / 4 / 0.00 | 词义较宽，须限定 | A guaranteed bend radius, material strength or safe blade path. |
| [`/wainscoting-calculator/`](https://woodworking-calculator.pages.dev/wainscoting-calculator/) | `wainscoting calculator` | 1,300 / 18 / 3.16 | 功能口径匹配 | Wall framing, molding compound cuts, or an installed structural design. |
| [`/stair-calculator/`](https://woodworking-calculator.pages.dev/stair-calculator/) | `stair treads calculator` | 1,600 / 18 / 0.00 | 功能口径匹配 | Stringer bearing strength, spiral stairs or building-code approval. |
| [`/rise-run-calculator/`](https://woodworking-calculator.pages.dev/rise-run-calculator/) | `rise and run` | 1,300 / 20 / 0.00 | 功能口径匹配 | Full roof cuts, stair step counts, or structural clearance checks. |
| [`/deck-material-calculator/`](https://woodworking-calculator.pages.dev/deck-material-calculator/) | `deck estimator` | 3,600 / 15 / 1.67 | 词义较宽，须限定 | Engineered joist-span capacity, footings, approved beams or fasteners. |
| [`/segmented-bowl-calculator/`](https://woodworking-calculator.pages.dev/segmented-bowl-calculator/) | `segmented bowl calculator` | 260 / 17 / 0.00 | 功能口径匹配 | Wood species machinability, glue-joint strength or lathe safety. |
| [`/roof-pitch-calculator/`](https://woodworking-calculator.pages.dev/roof-pitch-calculator/) | `pitch calculator` | 1,300 / 15 / 0.00 | 词义较宽，须限定 | Rafter birds-mouth geometry, hip-roof panel cuts or structural approval. |
| [`/equal-spacing-calculator/`](https://woodworking-calculator.pages.dev/equal-spacing-calculator/) | `equal spacing calculator` | 480 / 7 / 0.00 | 功能口径匹配 | Thickness-aware shelf clearances, railing code or drilling hardware limits. |
| [`/hip-rafter-calculator/`](https://woodworking-calculator.pages.dev/hip-rafter-calculator/) | `hip rafter calculator` | 170 / 8 / 2.75 | 功能口径匹配 | A complete hip roof sheathing layout, birdsmouth, or engineered timber. |
| [`/hip-roof-calculator/`](https://woodworking-calculator.pages.dev/hip-roof-calculator/) | `hip roof calculator` | 390 / 2 / 3.66 | 词义较宽，须限定 | A complete structural hip roof truss or verified on-site saw program. |
| [`/wall-stud-calculator/`](https://woodworking-calculator.pages.dev/wall-stud-calculator/) | `wall stud calculator` | 2,400 / 11 / 2.49 | 功能口径匹配 | Door and window King/Jack framing or sloped rake-wall stud lengths. |
| [`/shelf-spacing-calculator/`](https://woodworking-calculator.pages.dev/shelf-spacing-calculator/) | `shelf spacing calculator` | 140 / 5 / 0.00 | 功能口径匹配 | Hardware load capacity, shelf sag limits or a 1:1 drill jig. |
| [`/gable-roof-calculator/`](https://woodworking-calculator.pages.dev/gable-roof-calculator/) | `gable roof calculator` | 170 / 4 / 2.85 | 功能口径匹配 | Hip or valley roof cuts, sheathing nesting, or a structural roof design. |
| [`/square-layout-calculator/`](https://woodworking-calculator.pages.dev/square-layout-calculator/) | `foundation square calculator` | 590 / 17 / 0.00 | 功能口径匹配 | Structural footing design, concrete volume or a survey-grade report. |
| [`/diagonal-brace-calculator/`](https://woodworking-calculator.pages.dev/diagonal-brace-calculator/) | `cross brace angle calculator` | 90 / 11 / 0.00 | 功能口径匹配 | Engineered diagonal bracing resistance or an approved load path. |
| [`/hole-spacing-calculator/`](https://woodworking-calculator.pages.dev/hole-spacing-calculator/) | `hole spacing calculator` | 110 / 4 / 0.00 | 功能口径匹配 | A calibrated drill jig, fastener edge-distance code or shelf loading. |
| [`/stair-stringer-calculator/`](https://woodworking-calculator.pages.dev/stair-stringer-calculator/) | `stair stringer calculator` | 8,100 / 20 / 0.00 | 功能口径匹配 | Approved bearing cuts, structural stringer capacity or spiral stairs. |
| [`/roof-sheathing-calculator/`](https://woodworking-calculator.pages.dev/roof-sheathing-calculator/) | `roof sheathing calculator` | 590 / 3 / 3.00 | 功能口径匹配 | Hip valley panel cuts outside the entered geometry or an approved roof nailing schedule. |
| [`/fence-post-calculator/`](https://woodworking-calculator.pages.dev/fence-post-calculator/) | `fence post calculator` | 880 / 16 / 1.73 | 功能口径匹配 | Fence picket layout, post embedment or wind-load structural design. |
| [`/spiral-staircase-calculator/`](https://woodworking-calculator.pages.dev/spiral-staircase-calculator/) | `spiral staircase calculator` | 260 / 11 / 5.57 | 词义较宽，须限定 | Stair headroom or guardrail approval, multi-turn stair design, code compliance, structural bearing, pole  |
| [`/gambrel-roof-calculator/`](https://woodworking-calculator.pages.dev/gambrel-roof-calculator/) | `gambrel roof calculator` | 480 / 5 / 3.01 | 功能口径匹配 | Structural gambrel truss loads or joints, timber span design, bearing cuts, sheet nesting or roofing code |
| [`/lumber-price-calculator/`](https://woodworking-calculator.pages.dev/lumber-price-calculator/) | `price per thousand calculator` | 110 / 9 / 0.00 | 研究词歧义，暂不主攻 | A generic price per 1,000 items, hardwood market price feed, tree/log scaling, actual dressed-size lookup |
| [`/fence-picket-calculator/`](https://woodworking-calculator.pages.dev/fence-picket-calculator/) | `picket spacing calculator` | 210 / 2 / 0.00 | 功能口径匹配 | A structural fence span, curved cutting template, post embedment, safe pool barrier openings or approved  |
| [`/stave-calculator/`](https://woodworking-calculator.pages.dev/stave-calculator/) | `stave calculator` | 90 / 10 / 0.00 | 词义较宽，须限定 | A barrel bulge, guaranteed inner capacity, proven table-saw compound bevel or certified coopering and har |

**特别注意的几个宽词**：`stud calculator` 可能期待直墙立柱数量（另有 `/wall-stud-calculator/`），并非一定是斜山墙；`pitch calculator` 不一定指屋顶；`rafter calculator` 可能指数量/间距而不是鸟嘴切口；`kerf calculator` 可能是锯缝损耗而不是弯曲。当前页面使用具体任务标题而不自动塞入歧义词的做法应保留。`price per thousand calculator` 混合了一般单位数报价和木料 MBF；已有 `/lumber-price-calculator/` 只算 BF/MBF 木材报价，不能冒充通用每千件定价工具。

## 三、22 个疑点词：逐条处置，不自动新增页面

以下每项的“裁决”是**当前范围的保留/排除/进一步研究意见**，不是确认新关键词具备可赢得排名的机会。高 CPC 不等于广告展示收益；跨意图搜索词不能为追求规模强行合并。

| 原始研究关键词 | 美国月量 / KD / CPC($) | 处理类别 | 处理意见与真实能力差距 |
|---|---|---|---|
| `wall framing calculator with windows and doors` | 90 / 0 / 3.11 | 已纠正至现有工具 | Already supported: measured openings and King/Jack/header/sill on the framing calculator. Never claim it on the plain wall-stud route.；可能归属 `/framing-calculator/`（仍需遵守裁决状态） |
| `wall framing calculator` | 390 / 14 / 1.96 | 待进一步核实 SERP | Broad term; stronger candidate is opening-capable framing page, but verify present US SERP before claiming the unqualified phrase.；可能归属 `/framing-calculator/`（仍需遵守裁决状态） |
| `deck joist span calculator` | 720 / 16 / 1.83 | 需独立功能及安全审查 | Structural span depends on span tables, size, grade/species, loading, wet-service and code edition. Not safely supplied by material takeoff; independent standards and quali |
| `hip roof framing plan` | 90 / 16 / 0.00 | 教程/指南意图，现站不承接 | Search seeks complete framing plan, unlike this roof-line geometry; a documented field guide would need professional scope review, not a hidden keyword insertion. |
| `hip roof volume calculator` | 90 / 2 / 0.00 | 需独立功能及安全审查 | User wants enclosed 3D volume; hip rafter reference-line geometry does not calculate that volume. Low evidence priority; verify SERP and inputs before a feature. |
| `hip to gable calculator` | 140 / 6 / 0.00 | 需独立功能及安全审查 | Hip-to-gable conversion is a different roof conversion geometry/design task, not the gable surface-area tool; do not claim it. |
| `shelf bracket spacing calculator` | 90 / 0 / 0.00 | 需独立功能及安全审查 | Load-bearing bracket spacing/shelf sag requires material/stiffness/load and fixings; shelf-clearance and pin positions cannot substitute. |
| `coopering calculator` | 50 / 8 / 0.00 | 待进一步核实 SERP | Polygon-frustum stave calculations offer a nearby, narrower use case; real coopering often includes curved barrels/compound angles. Do not present as a synonym until SERP a；可能归属 `/stave-calculator/`（仍需遵守裁决状态） |
| `how to bend a plywood` | 260 / 25 / 0.00 | 教程/指南意图，现站不承接 | This is a practical tutorial and material-safety question, not a specific kerf geometry calculation; keep out of calculator metadata without researched editorial guidance. |
| `staircase spindle spacing calculator` | 110 / 14 / 0.00 | 需独立功能及安全审查 | Sloping stair rail needs incline/vertical projection and rail conventions; the level-opening baluster tool cannot safely claim that output. |
| `rafter spacing calculator` | 260 / 14 / 0.00 | 需独立功能及安全审查 | Rafter count/on-centre layout is different from rafter cut geometry; user-verified maximum spacing could support a distinct nonstructural layout mode, not code spacing reco |
| `deck post spacing calculator` | 590 / 8 / 1.09 | 需独立功能及安全审查 | Post/footing support layout requires beam/joist spans and loads. Current estimator's joist reference centers do not calculate bearing post positions. |
| `hip roof construction` | 590 / 7 / 0.00 | 教程/指南意图，现站不承接 | Construction guide and structural framing scope; line geometry is not a roof construction instruction manual. |
| `pointing calculator` | 1,900 / 15 / 2.91 | 不作为本项目目标词 | Web spot-check returned masonry mortar/repointing calculators, not woodworking equal-spacing. Remove from target claims; preserve only historical CSV. |
| `calculator center` | 110 / 14 / 0.00 | 不作为本项目目标词 | Generic calculator-service/navigation phrase; no evidence of wood-part center positions. Exclude. |
| `center calculator` | 110 / 6 / 0.00 | 不作为本项目目标词 | Generic ambiguous phrase; no evidence of timber center-spacing search intent. Exclude. |
| `deck framing calculator` | 210 / 15 / 1.42 | 需独立功能及安全审查 | Full deck frame involves structural beams, ledgers, supports and code. Current material takeoff is not a framing/footing design. |
| `decking joist spacing calculator` | 720 / 12 / 1.57 | 现有页面已支持限定几何模式 | 现有 Deck Material Estimator 可按用户独立核准的最大 OC 做等分中心线、数量和 CSV；不推荐结构合规间距、跨度或材料等级，宽泛 SERP 待核实。 |
| `deck joist spacing calculator` | 210 / 9 / 1.83 | 现有页面已支持限定几何模式 | 使用同一个可选等距中心线模式，而非建立第二个重复页面；必须输入独立验证的最大 OC，不能当结构承载或规范建议。 |
| `gambrel roof truss calculator` | 320 / 3 / 2.53 | 需独立功能及安全审查 | Two-pitch roof outline does not design truss chords, bearing, gussets, connectors and loads; a structural truss claim requires external design authority. |
| `gambrel truss calculator` | 260 / 9 / 2.49 | 需独立功能及安全审查 | Same structural truss gap as the gambrel roof truss term, not an SEO synonym for simple profile geometry. |
| `price per thousand calculator` | 110 / 9 / 0.00 | 不作为本项目目标词 | Generic per-thousand pricing may mean unit counts or lumber MBF. The live tool covers BF/MBF only; preserve the historical competitor association but do not target the unqu |

### 值得继续研究但不应立即开发的三类机会

1. **非结构性的龙骨等距排布**：`decking joist spacing calculator`（历史 720/月、KD12、CPC $1.57）与 `deck joist spacing calculator`（210/月、KD9、$1.83）是相近但可能重叠的搜索意图。竞品示例允许用户提供**已独立确认的最大 OC 间距**，仅输出等距中心线与数量，不推荐规范允许跨度；这一限定的纯几何功能已加入现有 Deck Material Estimator 的**可选等分模式**，默认仍保留原固定 OC；但尚不意味着宽泛关键词获得 SEO 同义词批准，实际 US SERP 仍待进一步核实。不要把两词 Volume 相加当独立需求。
2. **承重设计相关词应谨慎**：`deck joist span calculator`（720/月、KD16、$1.83）、`deck post spacing calculator`（590/月、KD8、$1.09）、`gambrel roof truss calculator`（320/月、KD3、$2.53）等涉及构件承载与当地适用规范。现有材料用量和屋顶轮廓算法不等于经过工程认证的结构尺寸；在没有具体标准版本、材料等级、设计荷载与审查前**不立项**。
3. **删去不相关流量诱惑**：`pointing calculator`（1,900/月、KD15、$2.91）经公开搜索样本检视主要指砌体勾缝的砂浆用量，**不是木件等距定位**。同理 `calculator center`、`center calculator` 没有足够的木工意图证据，不应塞进 Equal Spacing 页面。

### 外部公开样本：只能证明典型意图，不等于 US SERP 完整统计

| 搜索词 | 可核对的公开样本 | 对现有页面的启示 |
|---|---|---|
| `pointing calculator` | [Conserv 砌体砂浆用量计算](https://www.lime-mortars.co.uk/lime-mortar/calculators/pointing-calculator?product=MRN-003-012) | 无法把这一词变为木工定位页面的有效关键词 |
| `deck joist span calculator` | [DeckPro AWC DCA6 版的跨度表工具](https://deckpro.studio/tools/joist-span-calculator)、[HardHatCalc 结构跨度工具](https://hardhatcalc.com/calculators/structural/deck-joist-span-calculator) | 需求是材料/荷载/代码表条件下的结构跨度，不是采购数量 |
| `deck joist spacing calculator` | [Plan Otter：用户自行提供已验证最大 OC 的等距布局](https://theplanotter.com/decks/deck-joist-spacing-calculator/) | 可做几何排布，但不能推导“合规”允许间距 |
| `gambrel roof truss calculator` | [Medeek gambrel 计算资源](https://design.medeek.com/resources/resources.html)、[rooftrusscalculator.net 页面](https://rooftrusscalculator.net/gambrel-roof-truss-calculator/) | 即使能做折线轮廓，也不能承诺构件连接、荷载与桁架设计认证 |
| `staircase spindle spacing calculator` | [TK Stairs：有坡度/斜向长度输入的扶手栅杆计算](https://www.tkstairs.com/information-help/assembly-fitting-information/spindle-spacing) | 当前平直扶手页面不应自动认领斜梯扶手计算 |
| `coopering calculator` | [App Store Coopering Calculator：多种木桶/弧形计算](https://apps.apple.com/ly/app/coopering-calculator/id6759157985) | 现有 Stave 页面仅覆盖有界直线梯形面，属于更窄子任务 |
| `rafter spacing calculator` | [Craft Quantities：以设计给定 OC 算椽条数量](https://craftquantities.com/calculators/materials-quantities/pergola-rafter-spacing-calculator/) | 计数与等距布局不同于本项目 Rafter 的切口几何 |
| `price per thousand calculator` | [PriceCalculator 通用每千件价格](https://pricecalculator.org/per/price-per-thousand-calculator.html)、[Lumber Cost Per Thousand 木材 MBF 报价](https://molecalculator.com/Lumber-Cost-Per-Thousand-Calculator.php) | 搜索意图有两种；原始 Blocklayer 木材页排名证据不能证明本项目应主攻所有未限定场景 |

## 四、执行决策与判定规则

- **立即生效的页面策略**：31 个已有功能保持原有窄任务标题、真实公式、Worked Example、`Not covered` 与相关任务链接；只让 1 条已核实的门窗 framing 关键词出现在真正支持它的工具页；其余 21 条疑点不应作为 SEO 同义词自动渲染。**本次不添加新工具、不增加关键词页、不更改已有研究 CSV、不开放收录**。
- **以后只有满足全部条件才值得新立项**：①新鲜美国 SERP 与意图一致，②历史/最新 KD≤29 有可复核证据，③现有工具确实不支持，④可以输出有用且安全的专业结果，⑤独立 URL 不会与现有页关键词自相竞争。结构安全类还需当地规范与专业审查。
- **上线验证尚未完成**：正式域名、301 重定向、GSC 验证/索引、真实排名与访问量均未产生或未验证。域名购买后按 [实际上线交接](DOMAIN-LAUNCH-HANDOFF-20261107.md) 操作；实物/打印按 [现场验收](../FIELD-ACCEPTANCE-CHECKLIST.md) 执行。
- **追踪/机器校验**：裁决的结构化原始版本在 [`keyword-intent-closure-20261107.json`](keyword-intent-closure-20261107.json)，新增 [`tests/validate_keyword_closure.py`](../tests/validate_keyword_closure.py) 与 CI 一起验证 31+22 判断仍与功能配置和 152 条研究行保持一致。更改裁决要重新审查实际功能与搜索意图，不能通过单纯改 CSV 或 meta title“修复”。

**交付状态：功能/代码自动验收完成；关键词主任务覆盖完成、边界与疑点全部完成判定；真正 US SERP 全量验证、正式收录与排名尚未完成。**