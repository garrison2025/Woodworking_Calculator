# Workshop Geometry Tools｜木工尺寸、材料与排布计算器完整建站方案 V3.0（数据底稿与执行规格）
> **版本说明：V3.0 是正式开发规格，不是已部署网站。** 保留用户上传的 Blocklayer 前 400 条排名样本与已筛出的 152 个适用词（KD≤29），并为全部 31 个工具意图补齐工程输入、计算口径、测试样例、URL/索引约束和上线证据。V2.0 中所有数值均为 Semrush 估算，不是新站流量承诺。
> **工程约定：** 9 个 P0 与 17 个 P1 为一次性开发与验收范围；5 个 P2 属于有规格的后备意图，不因已有 URL 而提前发布或索引。任何风险较高的功能必须完成真实图纸与几何验证后上线。
> **研究日期：2026-11-04；研究对象：blocklayer.com；目标市场：美国（英语）。** 这是可交付开发的研究方案，不代表已经上线或已在 GitHub 仓库部署。既有 9 工具原型仍待升级、实测。
> **数据权威口径：** 用户上传的 Semrush 自然搜索排名导出 `/mnt/data/粘贴的文本 (1)(20261104-025308).txt`（400 行，未提供原始列标题；列次按 Semrush 典型导出与数字关系核对）。属于**前 400 行样本，不是全站约 9,470 个自然排名词**。美国数据库，流量/Volume/KD/CPC 均为平台模型估算，非实收与非 Google Analytics。
## 1. 决策与上线范围
- **项目决策：GO，开发完整的英语木工尺寸、用料、排布及可打印图纸工具站。** 不承诺排名或广告收入。
- **商业模式：** 免费实用计算器 + 将来申请/接入展示广告；不预设收费订阅。预计持续成本仅域名；Cloudflare Pages 静态托管，不采用收费 API、数据库、账户体系。实际免费配额按部署时条款核实。
- **目标用户：** 美国木工 DIY、装修工人、小型承包商、家具加工与木工爱好者；首选英制 ft/in、inch fractions，同时支持公制 mm/cm/m。
- **一期产品范围：** 9 个 P0 搜索意图，17 个 P1 补充工具；5 个 P2 低量/高复杂意图列入有依据的后备清单。P0/P1/P2 表示任务和发布优先级，不是页面数 KPI；所有要索引的 URL 必须有真实功能和独立用途。
- **不做：** 轮胎/摩托车、普通数学、手机水平仪、钢筋混凝土、管材焊接模板、通用单位换算及纯打印网格纸；这类词即使 KD 低，也不应混入本站。
## 2. 原始数据清洗结果与筛选规则
| 指标 | 数量 | 正确解释 |
|---|---:|---|
| 上传原始排名记录 | 400 | 截取 Semrush 自然排名明细中的 400 行 |
| 不重复关键词 | 378 | 精确字符串去重；含品牌词、异行业词 |
| 不重复竞品 URL | 94 | URL 可能是同一工具不同英制/公制版本，不能按数量套用 |
| 原始 KD≤29 记录 | 337 | 未过滤相关性和品牌词 |
| 木工/尺寸/排布范围内记录 | 181 | 由具体竞品 URL、查询意图分类 |
| 木工范围内 KD≤29 原始记录 | 162 | 尚含同一关键词多 URL 记录 |
| **适用的 KD≤29 去重关键词** | **152** | **研究关键词池**，非预期新站能获取的流量 |
| 其中普通自然结果 | 146 | 可以作为相应搜索词的常规排名证据 |
| 其中图片结果、AI 概览特殊结果 | 3 / 3 | 已另行标记；不得宣传为普通链接排名 |
| 木工范围内 KD≥30 的不同词 | 17 | 只作为语义相关词，不作为新站主要目标 |
| 归并后的拟议搜索意图与工具 URL | 31 | 9 个 P0、17 个 P1、5 个 P2 |
筛选规则：①先判断真实功能用途；②移除竞品品牌导航、其他品牌导航和弱相关行业；③采用 **KD≤29（含 29）** 作为新站主攻词上限；④同义词合并到同一 canonical URL；⑤美国数据库不推断西/葡语市场搜索量；⑥图片和 AI 特殊结果单独标记。全量保留、淘汰理由均见附表。
**列定义：** `estimated_visits` 是 Semrush 对关键词给竞品带来的月估算流量，`monthly_volume` 是这个词的月搜索量，`cpc_usd` 是付费搜索点击成本估算；`estimated_traffic_cost_usd` 不是自然收入。截取的 400 行**不能直接**用于推导整个站的非品牌占比。多同义词 Volume 求和存在搜索意图重叠，不能当作净受众或独立访客预测。
## 3. 优先级：9 个核心功能必须交付什么
| 工具 / SEO canonical | 数据证据（Volume / KD / 排名 / 竞品估算流量） | 实际输入 | 结果与差异化 | 实现边界 / 原型状态 |
|---|---|---|---|---|
| `/stud-calculator/` 斜墙立柱长度 | `stud calculator` 3600 / KD 1 / #1 / 892 | 斜墙跨距、起高、坡度、立柱间距、扣板厚、边界选项 | 逐根立柱位置与长度、顶部裁切角、SVG 斜墙图、CSV 木料表 | 需要区分斜墙山墙与普通墙体数量；支持 0 与最后一根边界处理；结构/承重不计算。**现有：基础斜墙几何；需补板厚、实际净高与全尺寸校验** |
| `/framing-calculator/` 带门窗洞口的墙体排布 | `framing calculator` 2400 / KD 3 / #2 / 156 | 墙长、间距、立柱厚、门窗开口起止位置/宽、高、边界选项 | 非开口区立柱位置、洞口区域可视化、数量统计、材料表 | 必须有门窗开口功能，不能继续只做无开口的平均分隔；不提供荷载/规范设计。**现有：仅无开口墙长/间距；核心搜索意图未完成** |
| `/deck-board-calculator/` 露台木板数量与缝隙 | `deck board calculator` 6600 / KD 12 / #8 / 145 | 铺装尺寸、木板实际面宽、预期缝隙、可购板长、损耗 | 板排布、最后一条裁边、用量、总线性尺、购料表 | 多种铺设方向、头尾接缝必须明确边界；初期支持平行直排与整板/裁切。**现有：基础直排数量，可扩展板长组合与排版图** |
| `/baluster-spacing-calculator/` 栏杆竖杆间距 | `baluster spacing calculator` 1000 / KD 16 / #2 / 132 | 净跨距、竖杆宽度、目标最大净缝、端部条件 | 竖杆根数、实际等距净缝、中心距、坐标表、SVG | 等距几何和当地栏杆规范是两回事；不能声称自动判定儿童安全合规。**现有：平均间距计算，需扩展端距选项与毫米显示** |
| `/rafter-calculator/` 椽木几何与切割尺寸 | `rafter calculator` 4400 / KD 7 / #3 / 360 | 净跨距、坡度（x:12/角度）、ridge 厚度、挑檐、椽木尺寸 | run、rise、线长、切口角、SVG 尺寸图、可打印切割参考 | 竞品支持 birdsmouth、seat/plumb；简化斜边长度不能声称同等功能；结构荷载需专业审查。**现有：run/rise/斜线长度；切口、ridge、鸟嘴缺失** |
| `/crown-molding-calculator/` 顶角线复合切角 | `crown molding calculator` 390 / KD 9 / #1 / 96 | spring angle、墙角度、左/右、内/外角 | miter、bevel、锯台朝向说明、直观角度草图 | 输入角度约定与左右正负号需要清晰，试切验证；与图库和通用角度页去重。**现有：角度数值，需补方向与可打印图** |
| `/soffit-calculator/` 檐底垂距 | `soffit calculator` 1600 / KD 1 / #7 / 35 | 坡度、檐口宽、檐板厚、椽木深、檐底构造厚度 | 檐底垂距、构件长度、侧视剖面 SVG | 必须定义清楚 soffit drop 的参考面和各厚度叠加关系。**新工具，需按真实剖面公式开发** |
| `/kerf-bending-calculator/` 锯缝弯木间距 | `kerf calculator` 210 / KD 4 / #1 / 52 | 目标曲率半径、弧度、锯缝宽、板厚、剩余厚、锯条宽 | 锯缝数、中心距、展开切割刻度、全尺寸打印模板 | 材性和实际可弯曲半径是经验问题；仅提供几何建议与试样提示。**新工具，需做木材厚度与半径组合边界测试** |
| `/wainscoting-calculator/` 护墙板/线板排布 | `wainscoting calculator` 1300 / KD 18 / #3 / 57 | 墙长、壁板宽、缝/框宽、边缘留白、线板厚 | 面板数量、均匀分布尺寸、切割清单与 SVG | 门窗/踢脚线等开口影响面板数量，输入尺寸需分清外缘/净距。**新工具，需提供排布选项** |
**首批发布门槛：** 每个工具必须至少支持一组可复算的真实结果、完整交互表单、带单位的结果、SVG 图形、复制结果、移动端、打印/下载、错误输入提示；没有完成真实功能的页面使用 `noindex`，不进入 sitemap。
### P0 精度核验样例（独立于竞品代码推导）
| 任务 | 测试输入 | 应得到的可核算结果 | 必须声明的限制 |
|---|---|---|---|
| 斜墙立柱 | 墙长 144in、起高 96in、坡度 6:12、16in 中心距 | 144in 处理论末端顶高为 168in，需按边界/板厚计算实际净长 | 不等于真实框架下料长，必须扣除板厚 |
| 露台板 | 覆盖宽 120in、面宽 5.5in、缝 0.125in | `ceil((120+0.125)/(5.5+0.125))=22` 排；理论末板需裁约 3.625in | 固定直排、不考虑端接与材料弯曲 |
| 栏杆竖杆 | 净跨距 96in、每杆 1.5in、目标净间隙≤4in | 17 根、18 个净空、净缝约 3.917in | 不是当地建筑/儿童安全合规证明 |
| 标准椽木 | 单侧水平 run=120in、坡度6:12 | rise=60in，参考斜线长度约 134.164in | ridge、挑檐、birdsmouth 需分别计算 |
| 顶角线 | spring 38°、墙角 90° | miter 约31.62°、bevel 约33.86°（约定需固定） | 左右内外角和锯台切割方向另列 |
其他工具都需准备至少 5 个边界算例：合法最小值、大值、非整数、超界输入、英制/公制等价结果。每个新算法用公开几何定理或可重复的参考算例核实。
## 4. P1/P2 完整工具矩阵
| 优先级 | 拟议 URL | 功能 | 从本数据中对应的最佳关键词与指标 | 特殊开发注意 |
|---|---|---|---|---|
| **P1** | `/stair-calculator/` | 直跑楼梯几何 | `stair treads calculator`：1600/月，KD 18，排名 2，估算流量 104 | 几何直跑楼梯、踏步及平台长度；不做法规或安全验收。 |
| **P1** | `/rise-run-calculator/` | 坡度 Rise/Run | `rise and run`：1300/月，KD 20，排名 2，估算流量 106 | 把 rise/run、坡度比与角度转换归于一个页面；roof pitch 工具只负责屋顶 x:12 表达。 |
| **P1** | `/deck-material-calculator/` | 露台材料布局估算 | `deck estimator`：3600/月，KD 15，排名 8，估算流量 79 | 针对 deck estimator/deck calculator 的材料排布；不能把结构跨度建议伪装成工程审批。 |
| **P1** | `/segmented-bowl-calculator/` | 分段木碗圈段切角 | `segmented bowl calculator`：260/月，KD 17，排名 1，估算流量 64 | 分段木碗圈、每段梯形切角、排样与打印模板。 |
| **P1** | `/roof-pitch-calculator/` | 屋顶坡度转角度 | `pitch calculator`：1300/月，KD 15，排名 4，估算流量 84 | 只要是角度换算意图，不为同义词制作单独 URL。 |
| **P1** | `/equal-spacing-calculator/` | 中心距等分 | `equal spacing calculator`：480/月，KD 7，排名 4，估算流量 31 | 中心点/边缘距的等分计算，需处理端距公式。 |
| **P1** | `/hip-rafter-calculator/` | 斜脊椽木几何 | `hip rafter calculator`：170/月，KD 8，排名 1，估算流量 42 | 斜脊几何尺寸与 roof hip 相关表，区别于屋面裁板。 |
| **P1** | `/hip-roof-calculator/` | 四坡屋顶板材切割 | `hip roof calculator`：390/月，KD 2，排名 1，估算流量 96 | 竞品是 hip-valley-sheet-cut，不能仅输出一条假设等坡斜线。 |
| **P1** | `/wall-stud-calculator/` | 普通墙体立柱数量 | `wall stud calculator`：2400/月，KD 11，排名 10，估算流量 21 | 普通墙体根数/中心线；与斜墙长度工具不同任务。 |
| **P1** | `/shelf-spacing-calculator/` | 层板均匀间距 | `shelf spacing calculator`：140/月，KD 5，排名 1，估算流量 34 | 固定高度与层板厚度下的净层间距、孔位坐标。 |
| **P1** | `/gable-roof-calculator/` | 人字形屋顶几何 | `gable roof calculator`：170/月，KD 4，排名 1，估算流量 42 | 人字屋顶长宽坡度与屋面积；仅几何量。 |
| **P1** | `/square-layout-calculator/` | 矩形对角线找方 | `foundation square calculator`：590/月，KD 17，排名 7，估算流量 14 | 对角找方/3-4-5 法则及误差计算，功能无需承重参数。 |
| **P1** | `/diagonal-brace-calculator/` | 斜撑长度和角度 | `cross brace angle calculator`：90/月，KD 11，排名 1，估算流量 22 | 斜撑尺寸图；不提供受力设计。 |
| **P1** | `/hole-spacing-calculator/` | 钻孔等距排布 | `hole spacing calculator`：110/月，KD 4，排名 1，估算流量 27 | 一排或多排孔的坐标输出与可打印定位图。 |
| **P1** | `/stair-stringer-calculator/` | 楼梯侧梁（stringer）切割几何 | `stair stringer calculator`：8100/月，KD 20，排名 11，估算流量 24 | 单独输出直跑楼梯侧梁切口位置、重复切角、台阶布置，必须与 spiral stairs 区分；竞品命中的螺旋 URL 不是充分意图匹配证据。 |
| **P1** | `/roof-sheathing-calculator/` | 屋顶面板用量 | `roof sheathing calculator`：590/月，KD 3，排名 7，估算流量 14 | 平面屋面积、面板规格、裁板用量与损耗；需注明布局假设。 |
| **P1** | `/fence-post-calculator/` | 围栏柱数量与间距 | `fence post calculator`：880/月，KD 16，排名 9，估算流量 11 | 围栏长度、柱宽、标准间距、端部留白与实际中心距。 |
| **P2** | `/spiral-staircase-calculator/` | 螺旋楼梯几何 | `spiral staircase calculator`：260/月，KD 11，排名 1，估算流量 64 | 参数及安全边界复杂；诸如 stair stringer calculator 与螺旋楼梯页面的排名并不等同搜索意图。 |
| **P2** | `/gambrel-roof-calculator/` | 折线屋顶几何 | `gambrel roof calculator`：480/月，KD 5，排名 2，估算流量 31 | 两段屋顶不同坡度的实际长度、分点坐标与尺寸图；不做桁架荷载设计。 |
| **P2** | `/lumber-price-calculator/` | 木材成本单价换算 | `price per thousand calculator`：110/月，KD 9，排名 2，估算流量 14 | 仅一般木材用料/成本辅助，核心搜索量小。 |
| **P2** | `/fence-picket-calculator/` | 围栏板排布 | `picket spacing calculator`：210/月，KD 2，排名 3，估算流量 9 | 围栏栅板间距与造型 SVG。 |
| **P2** | `/stave-calculator/` | 锥形桶板切角 | `stave calculator`：90/月，KD 10，排名 2，估算流量 11 | 桶板侧边角与尺寸展平，需数学样例核对。 |
### 需要特别处理的关键词不匹配
- `stud calculator` 的竞品排在 `gable-studs` 斜墙立柱页面，和普通 wall stud count 不完全相同。本站保留两个不同任务：`/stud-calculator/`（斜墙）与 `/wall-stud-calculator/`（普通墙）；不会虚构两个词均已验证独立大流量。
- `framing calculator` 的竞品页面是 **wall framing with openings**。现有原型只有无开口排布，必须按 P0 补齐门窗功能才能主攻该关键词。
- `rafter calculator` 竞品提供 birdsmouth 等实际切割参数。若只计算 sqrt(run²+rise²)，不能宣传覆盖该词的全部功能。
- `hip roof calculator` 的实际对标 URL 是 **hip valley sheet cut**，与只有单条 hip 对角线几何的原型存在差距。
- `deck joist span calculator` 虽然 KD 16，但承重跨度涉及材料等级和本地规范；只能标明“几何布局”，不得输出未经校验的承载建议。
- `calculator.net stair calculator` 是第三方品牌词，虽然 KD≤29 也不纳入自然长尾目标；`stair stringer calculator` 排到了对手的 spiral 页面，需要独立做 SERP 意图判断，不能因排名就认定螺旋楼梯是精确匹配。
## 5. 关键词地图与站点结构
````text
/                             首页：Workshop Geometry Tools
/framing/                     墙体与立柱目录
/decks-and-railings/          露台、栏杆、围栏目录
/roof-and-stairs/             屋面和楼梯目录
/interior-finish/             木作线条与室内面板目录
/woodworking/                 木作切削、排布和模板目录
/materials/                   木材用量和价格目录
/{specific-calculator}/       31 种规划中的独立工具意图；实际发布以功能验收为准
/about/ /contact/ /privacy/ /terms/
````
**路由规则：** 每种不同用户任务恰有一个 canonical 页面；站点目录只有真实导航价值时才索引。公英制用**同 URL 内切换单位**，不为 `eng`/`metric` 复制两个高度相似的 URL。查询参数仅用于传递初始数值，不生成可索引页面。
### 31 个意图聚合的数据矩阵
> 表中的 “可见关键词流量合计” 仅是本次选定关键词的 Semrush 估算贡献和，不是 URL 完整自然流量，不代表新站预测，也未对跨词同一用户去重。
| 优先级 | 路由 | 关键词数（去重） | 最大单词月搜索量 | 最低 KD | 竞品可见关键词估算流量合计 | 竞品 URL 数 |
|---|---|---:|---:|---:|---:|---:|
| P0 | `/stud-calculator/` | 4 | 3,600 | 1 | 948 | 3 |
| P0 | `/rafter-calculator/` | 12 | 4,400 | 2 | 485 | 2 |
| P0 | `/baluster-spacing-calculator/` | 12 | 1,300 | 1 | 387 | 2 |
| P0 | `/crown-molding-calculator/` | 14 | 590 | 5 | 247 | 1 |
| P0 | `/kerf-bending-calculator/` | 8 | 320 | 1 | 247 | 3 |
| P0 | `/deck-board-calculator/` | 5 | 6,600 | 12 | 179 | 3 |
| P0 | `/framing-calculator/` | 1 | 2,400 | 3 | 156 | 1 |
| P0 | `/wainscoting-calculator/` | 2 | 1,300 | 15 | 64 | 1 |
| P0 | `/soffit-calculator/` | 2 | 1,600 | 1 | 45 | 1 |
| P1 | `/stair-calculator/` | 11 | 6,600 | 8 | 248 | 2 |
| P1 | `/rise-run-calculator/` | 6 | 1,600 | 20 | 211 | 2 |
| P1 | `/deck-material-calculator/` | 8 | 6,600 | 7 | 173 | 2 |
| P1 | `/segmented-bowl-calculator/` | 4 | 260 | 5 | 155 | 1 |
| P1 | `/roof-pitch-calculator/` | 7 | 6,600 | 14 | 135 | 2 |
| P1 | `/equal-spacing-calculator/` | 8 | 1,900 | 3 | 112 | 2 |
| P1 | `/hip-rafter-calculator/` | 9 | 1,300 | 0 | 106 | 1 |
| P1 | `/hip-roof-calculator/` | 1 | 390 | 2 | 96 | 1 |
| P1 | `/wall-stud-calculator/` | 8 | 2,400 | 0 | 78 | 1 |
| P1 | `/shelf-spacing-calculator/` | 4 | 140 | 0 | 77 | 2 |
| P1 | `/gable-roof-calculator/` | 2 | 170 | 4 | 53 | 1 |
| P1 | `/square-layout-calculator/` | 5 | 590 | 7 | 49 | 2 |
| P1 | `/diagonal-brace-calculator/` | 2 | 110 | 11 | 36 | 1 |
| P1 | `/hole-spacing-calculator/` | 1 | 110 | 4 | 27 | 1 |
| P1 | `/stair-stringer-calculator/` | 1 | 8,100 | 20 | 24 | 1 |
| P1 | `/roof-sheathing-calculator/` | 1 | 590 | 3 | 14 | 1 |
| P1 | `/fence-post-calculator/` | 1 | 880 | 16 | 11 | 1 |
| P2 | `/spiral-staircase-calculator/` | 4 | 260 | 11 | 107 | 1 |
| P2 | `/gambrel-roof-calculator/` | 4 | 480 | 3 | 60 | 1 |
| P2 | `/lumber-price-calculator/` | 2 | 140 | 4 | 25 | 1 |
| P2 | `/fence-picket-calculator/` | 2 | 480 | 2 | 18 | 1 |
| P2 | `/stave-calculator/` | 1 | 90 | 10 | 11 | 1 |
## 6. 152 条完整适用关键词清单（来自本次 400 行原始表）
以下逐条列出，不人为猜测搜索量。注意部分图片结果 / AI 概览不视为普通自然排名。“归属 URL”表示拟议本站 canonical，而“参考 URL”是此次真实竞品排名页。
### Framing & walls（20 词）
| 关键词 | Volume/月 | KD | 竞品排名 | 竞品估算访问/月 | CPC($) | 证据类型 | 归属 URL | 真实参考 URL |
|---|---:|---:|---|---:|---:|---|---|---|
| `stud calculator` | 3600 | 1 | 1 | 892 | 2.49 | 普通自然 | `/stud-calculator/` | https://www.blocklayer.com/gable-studs |
| `framing calculator` | 2400 | 3 | 2 | 156 | 2.75 | 普通自然 | `/framing-calculator/` | https://www.blocklayer.com/wall-framing-openings |
| `rake wall calculator` | 90 | 6 | 1 | 22 | 0.0 | 普通自然 | `/stud-calculator/` | https://www.blocklayer.com/gable-studseng |
| `raking wall calculator` | 70 | 2 | 1 | 17 | 0.0 | 普通自然 | `/stud-calculator/` | https://www.blocklayer.com/wall-framingeng |
| `raked wall calculator` | 70 | 2 | 1 | 17 | 0.0 | 普通自然 | `/stud-calculator/` | https://www.blocklayer.com/gable-studs |
| `cross brace angle calculator` | 90 | 11 | 1 | 22 | 0.0 | 普通自然 | `/diagonal-brace-calculator/` | https://www.blocklayer.com/diagonal-bracingeng |
| `wall stud calculator` | 2400 | 11 | 10 | 21 | 2.49 | 普通自然 | `/wall-stud-calculator/` | https://www.blocklayer.com/wall-framingeng |
| `gate brace calculator` | 110 | 11 | 1 | 14 | 0.0 | 普通自然 | `/diagonal-brace-calculator/` | https://www.blocklayer.com/diagonal-bracingeng |
| `foundation square calculator` | 590 | 17 | 7 | 14 | 0.0 | 普通自然 | `/square-layout-calculator/` | https://www.blocklayer.com/square-upeng |
| `foundation calculator square` | 590 | 14 | 7 | 14 | 0.0 | 普通自然 | `/square-layout-calculator/` | https://www.blocklayer.com/square-up |
| `wall calculator` | 260 | 23 | 5 | 11 | 3.73 | 普通自然 | `/wall-stud-calculator/` | https://www.blocklayer.com/wall-framingeng |
| `wall framing calculator with windows and doors` | 90 | 0 | 2 | 11 | 3.11 | 普通自然 | `/wall-stud-calculator/` | https://www.blocklayer.com/wall-framingeng |
| `wall framing calculator` | 390 | 14 | 6 | 9 | 1.96 | 普通自然 | `/wall-stud-calculator/` | https://www.blocklayer.com/wall-framingeng |
| `stud spacing calculator` | 90 | 10 | 3 | 7 | 0.0 | 普通自然 | `/wall-stud-calculator/` | https://www.blocklayer.com/wall-framingeng |
| `square a building calculator` | 170 | 10 | 3 | 7 | 3.08 | 普通自然 | `/square-layout-calculator/` | https://www.blocklayer.com/square-upeng |
| `building square calculator` | 260 | 7 | 4 | 7 | 2.79 | 普通自然 | `/square-layout-calculator/` | https://www.blocklayer.com/square-upeng |
| `stud calculator for wall` | 320 | 13 | 8 | 7 | 1.88 | 普通自然 | `/wall-stud-calculator/` | https://www.blocklayer.com/wall-framingeng |
| `square to rectangle` | 210 | 24 | 3 | 7 | 0.0 | 普通自然 | `/square-layout-calculator/` | https://www.blocklayer.com/square-upeng |
| `wall stud layout` | 210 | 23 | 2 | 6 | 0.0 | 普通自然 | `/wall-stud-calculator/` | https://www.blocklayer.com/wall-framingeng |
| `framing layout` | 260 | 26 | 2 | 6 | 2.79 | 普通自然 | `/wall-stud-calculator/` | https://www.blocklayer.com/wall-framingeng |
### Decks & railings（28 词）
| 关键词 | Volume/月 | KD | 竞品排名 | 竞品估算访问/月 | CPC($) | 证据类型 | 归属 URL | 真实参考 URL |
|---|---:|---:|---|---:|---:|---|---|---|
| `deck board calculator` | 6600 | 12 | 8 | 145 | 1.67 | 普通自然 | `/deck-board-calculator/` | https://www.blocklayer.com/deckcalculatoreng |
| `baluster spacing calculator` | 1000 | 16 | 2 | 132 | 3.0 | 普通自然 | `/baluster-spacing-calculator/` | https://www.blocklayer.com/baluster-spacingeng |
| `baluster calculator` | 1000 | 23 | 3 | 82 | 4.3 | 普通自然 | `/baluster-spacing-calculator/` | https://www.blocklayer.com/baluster-spacingeng |
| `deck railing spindle spacing calculator` | 1300 | 21 | 3 | 45 | 3.35 | 普通自然 | `/baluster-spacing-calculator/` | https://www.blocklayer.com/baluster-spacingeng |
| `balustrade spacing` | 320 | 24 | 1 | 26 | 1.62 | 普通自然 | `/baluster-spacing-calculator/` | https://www.blocklayer.com/baluster-spacing |
| `spindle calculator` | 260 | 21 | 3 | 21 | 0.0 | 普通自然 | `/baluster-spacing-calculator/` | https://www.blocklayer.com/baluster-spacingeng |
| `balustrade spacing calculator` | 70 | 1 | 1 | 17 | 3.0 | 普通自然 | `/baluster-spacing-calculator/` | https://www.blocklayer.com/baluster-spacing |
| `spindle spacing calculator` | 320 | 21 | 3 | 14 | 1.97 | 普通自然 | `/baluster-spacing-calculator/` | https://www.blocklayer.com/baluster-spacingeng |
| `baluster spacing calculator deck` | 390 | 21 | 4 | 13 | 0.0 | 普通自然 | `/baluster-spacing-calculator/` | https://www.blocklayer.com/baluster-spacingeng |
| `baluster spacer` | 50 | 14 | 1 | 12 | 0.96 | 普通自然 | `/baluster-spacing-calculator/` | https://www.blocklayer.com/baluster-spacingeng |
| `deck board spacing` | 1600 | 14 | 7 | 11 | 0.85 | 普通自然 | `/deck-board-calculator/` | https://www.blocklayer.com/deckboardseng |
| `railing calculator` | 260 | 19 | 3 | 11 | 2.28 | 普通自然 | `/baluster-spacing-calculator/` | https://www.blocklayer.com/baluster-spacingeng |
| `deck board spacing calculator` | 140 | 12 | 2 | 9 | 1.68 | 普通自然 | `/deck-board-calculator/` | https://www.blocklayer.com/deckboardseng |
| `staircase spindle spacing calculator` | 110 | 14 | 3 | 7 | 0.0 | 普通自然 | `/baluster-spacing-calculator/` | https://www.blocklayer.com/baluster-spacingeng |
| `deck board calculator with spacing` | 90 | 25 | 2 | 7 | 1.4 | 普通自然 | `/deck-board-calculator/` | https://www.blocklayer.com/deckboardseng |
| `baluster calculator spacing` | 170 | 21 | 3 | 7 | 3.0 | 普通自然 | `/baluster-spacing-calculator/` | https://www.blocklayer.com/baluster-spacingeng |
| `deck spacing calculator` | 90 | 13 | 1 | 7 | 1.79 | 普通自然 | `/deck-board-calculator/` | https://www.blocklayer.com/deckboards |
| `deck estimator` | 3600 | 15 | 8 | 79 | 1.67 | 普通自然 | `/deck-material-calculator/` | https://www.blocklayer.com/deckcalculatoreng |
| `deck calculator` | 6600 | 29 | 15 | 19 | 1.67 | 普通自然 | `/deck-material-calculator/` | https://www.blocklayer.com/deckcalculatoreng |
| `decking joist spacing calculator` | 720 | 12 | 4 | 17 | 1.57 | 普通自然 | `/deck-material-calculator/` | https://www.blocklayer.com/deckcalculatoreng |
| `deck joist span calculator` | 720 | 16 | 7 | 17 | 1.83 | 普通自然 | `/deck-material-calculator/` | https://www.blocklayer.com/deckcalculatoreng |
| `deck post spacing calculator` | 590 | 8 | 6 | 14 | 1.09 | 普通自然 | `/deck-material-calculator/` | https://www.blocklayer.com/deckcalculatoreng |
| `free deck calculator` | 880 | 7 | 图片包 | 12 | 1.41 | 图片结果 | `/deck-material-calculator/` | https://www.blocklayer.com/deckcalculator |
| `fence post calculator` | 880 | 16 | 9 | 11 | 1.73 | 普通自然 | `/fence-post-calculator/` | https://www.blocklayer.com/fence/post-rail |
| `deck joist spacing calculator` | 210 | 9 | 3 | 9 | 1.83 | 普通自然 | `/deck-material-calculator/` | https://www.blocklayer.com/deckcalculatoreng |
| `deck framing calculator` | 210 | 15 | 4 | 6 | 1.42 | 普通自然 | `/deck-material-calculator/` | https://www.blocklayer.com/deckcalculatoreng |
| `picket spacing calculator` | 210 | 2 | 3 | 9 | 0.0 | 普通自然 | `/fence-picket-calculator/` | https://www.blocklayer.com/fence/picket-arch |
| `fence picket calculator` | 480 | 17 | 8 | 9 | 2.05 | 普通自然 | `/fence-picket-calculator/` | https://www.blocklayer.com/fence/picket-arch |
### Roofs & stairs（60 词）
| 关键词 | Volume/月 | KD | 竞品排名 | 竞品估算访问/月 | CPC($) | 证据类型 | 归属 URL | 真实参考 URL |
|---|---:|---:|---|---:|---:|---|---|---|
| `rafter calculator` | 4400 | 7 | 3 | 360 | 2.38 | 普通自然 | `/rafter-calculator/` | https://www.blocklayer.com/roof/raftereng |
| `soffit calculator` | 1600 | 1 | 7 | 35 | 4.28 | 普通自然 | `/soffit-calculator/` | https://www.blocklayer.com/roof/soffit-drop |
| `rafter calculator online` | 90 | 10 | 1 | 22 | 0.0 | 普通自然 | `/rafter-calculator/` | https://www.blocklayer.com/roof/raftereng |
| `rafter calc` | 170 | 9 | 3 | 13 | 2.38 | 普通自然 | `/rafter-calculator/` | https://www.blocklayer.com/roof/raftereng |
| `roof rafter calculator` | 720 | 11 | 7 | 13 | 2.45 | 普通自然 | `/rafter-calculator/` | https://www.blocklayer.com/roof/raftereng |
| `cutting rafters calculator` | 50 | 2 | 1 | 12 | 2.34 | 普通自然 | `/rafter-calculator/` | https://www.blocklayer.com/roof/raftereng |
| `calculate rafter` | 210 | 23 | AI 概览 | 12 | 1.06 | AI概览 | `/rafter-calculator/` | https://www.blocklayer.com/roof/raftereng |
| `rafter spacing calculator` | 260 | 14 | 4 | 11 | 0.0 | 普通自然 | `/rafter-calculator/` | https://www.blocklayer.com/roof/rafter |
| `rafter angle calculator` | 140 | 17 | 3 | 11 | 2.11 | 普通自然 | `/rafter-calculator/` | https://www.blocklayer.com/roof/rafter |
| `dropped soffit` | 170 | 7 | AI 概览 | 10 | 0.0 | AI概览 | `/soffit-calculator/` | https://www.blocklayer.com/roof/soffit-drop |
| `calculate rafter length` | 480 | 19 | 9 | 9 | 1.87 | 普通自然 | `/rafter-calculator/` | https://www.blocklayer.com/roof/rafter |
| `birdsmouth cut calculator` | 390 | 5 | 4 | 8 | 1.98 | 普通自然 | `/rafter-calculator/` | https://www.blocklayer.com/roof/raftereng |
| `birdsmouth calculator` | 110 | 10 | 4 | 7 | 0.0 | 普通自然 | `/rafter-calculator/` | https://www.blocklayer.com/roof/raftereng |
| `online rafter calculator` | 90 | 17 | 2 | 7 | 0.0 | 普通自然 | `/rafter-calculator/` | https://www.blocklayer.com/roof/raftereng |
| `rise and run` | 1300 | 20 | 2 | 106 | 0.0 | 普通自然 | `/rise-run-calculator/` | https://www.blocklayer.com/riserun |
| `stair treads calculator` | 1600 | 18 | 2 | 104 | 0.0 | 普通自然 | `/stair-calculator/` | https://www.blocklayer.com/stairs/spiral-stairseng |
| `hip roof calculator` | 390 | 2 | 1 | 96 | 3.66 | 普通自然 | `/hip-roof-calculator/` | https://www.blocklayer.com/roof/hip-valley-sheet-cut |
| `pitch calculator` | 1300 | 15 | 4 | 84 | 0.0 | 普通自然 | `/roof-pitch-calculator/` | https://www.blocklayer.com/riserun |
| `rise run` | 880 | 21 | 2 | 57 | 0.0 | 普通自然 | `/rise-run-calculator/` | https://www.blocklayer.com/riserun |
| `hip rafter calculator` | 170 | 8 | 1 | 42 | 2.75 | 普通自然 | `/hip-rafter-calculator/` | https://www.blocklayer.com/roof/hipeng |
| `gable roof calculator` | 170 | 4 | 1 | 42 | 2.85 | 普通自然 | `/gable-roof-calculator/` | https://www.blocklayer.com/roof/gableeng |
| `stairs measurement` | 260 | 13 | 1 | 34 | 0.13 | 普通自然 | `/stair-calculator/` | https://www.blocklayer.com/stairs/straight |
| `stair stringer calculator` | 8100 | 20 | 11 | 24 | 0.0 | 普通自然 | `/stair-stringer-calculator/` | https://www.blocklayer.com/stairs/spiral-stairseng |
| `stairs calculator` | 4400 | 16 | 12 | 22 | 0.04 | 普通自然 | `/stair-calculator/` | https://www.blocklayer.com/stairs/straight |
| `run rise calculator` | 170 | 22 | 2 | 22 | 0.0 | 普通自然 | `/rise-run-calculator/` | https://www.blocklayer.com/riseruneng |
| `staircase calculator` | 1000 | 13 | 8 | 19 | 0.04 | 普通自然 | `/stair-calculator/` | https://www.blocklayer.com/stairs/spiral-stairseng |
| `stair calc` | 720 | 11 | 7 | 17 | 0.15 | 普通自然 | `/stair-calculator/` | https://www.blocklayer.com/stairs/straight |
| `staircase calculator online` | 590 | 12 | 7 | 14 | 0.99 | 普通自然 | `/stair-calculator/` | https://www.blocklayer.com/stairs/spiral-stairseng |
| `roof sheathing calculator` | 590 | 3 | 7 | 14 | 3.0 | 普通自然 | `/roof-sheathing-calculator/` | https://www.blocklayer.com/roof/sheathing |
| `rise run angle calculator` | 170 | 14 | 3 | 11 | 0.0 | 普通自然 | `/roof-pitch-calculator/` | https://www.blocklayer.com/riserun |
| `rise to run calculator` | 90 | 25 | 2 | 11 | 0.0 | 普通自然 | `/rise-run-calculator/` | https://www.blocklayer.com/riseruneng |
| `hip roof framing plan` | 90 | 16 | 1 | 11 | 0.0 | 普通自然 | `/hip-rafter-calculator/` | https://www.blocklayer.com/roof/hipeng |
| `hip to gable calculator` | 140 | 6 | 2 | 11 | 0.0 | 普通自然 | `/gable-roof-calculator/` | https://www.blocklayer.com/roof/gableeng |
| `hip rafter` | 480 | 17 | 3 | 10 | 0.0 | 普通自然 | `/hip-rafter-calculator/` | https://www.blocklayer.com/roof/hipeng |
| `rise and run angle calculator` | 110 | 20 | 3 | 9 | 0.0 | 普通自然 | `/roof-pitch-calculator/` | https://www.blocklayer.com/riserun |
| `calculations for stairs` | 6600 | 23 | 14 | 9 | 0.04 | 普通自然 | `/stair-calculator/` | https://www.blocklayer.com/stairs/straight |
| `roof hip` | 1300 | 24 | 6 | 9 | 2.49 | 普通自然 | `/hip-rafter-calculator/` | https://www.blocklayer.com/roof/hipeng |
| `roof pitch to degrees` | 720 | 23 | 8 | 9 | 0.88 | 普通自然 | `/roof-pitch-calculator/` | https://www.blocklayer.com/pitchangle |
| `stair stringer calculator online` | 320 | 21 | 4 | 9 | 0.0 | 普通自然 | `/stair-calculator/` | https://www.blocklayer.com/stairs/straight |
| `figuring roof angles` | 6600 | 15 | 10 | 9 | 1.06 | 普通自然 | `/roof-pitch-calculator/` | https://www.blocklayer.com/pitchangle |
| `rise over run formula` | 1600 | 28 | 7 | 8 | 0.0 | 普通自然 | `/rise-run-calculator/` | https://www.blocklayer.com/riserun |
| `roof pitch to angle calculator` | 110 | 18 | 3 | 7 | 2.52 | 普通自然 | `/roof-pitch-calculator/` | https://www.blocklayer.com/pitchangle |
| `hip roof volume calculator` | 90 | 2 | 3 | 7 | 0.0 | 普通自然 | `/hip-rafter-calculator/` | https://www.blocklayer.com/roof/hipeng |
| `stair calcuator` | 210 | 19 | 6 | 7 | 0.15 | 普通自然 | `/stair-calculator/` | https://www.blocklayer.com/stairs/straight |
| `hip roof construction` | 590 | 7 | 4 | 7 | 0.0 | 普通自然 | `/hip-rafter-calculator/` | https://www.blocklayer.com/roof/hipeng |
| `deck stair calculator` | 2400 | 8 | 11 | 7 | 0.67 | 普通自然 | `/stair-calculator/` | https://www.blocklayer.com/stairs/straight |
| `hipped roof calculator` | 30 | 0 | 1 | 7 | 3.66 | 普通自然 | `/hip-rafter-calculator/` | https://www.blocklayer.com/roof/hipeng |
| `roof hip calculator` | 30 | 16 | 1 | 7 | 3.2 | 普通自然 | `/hip-rafter-calculator/` | https://www.blocklayer.com/roof/hipeng |
| `run rise` | 170 | 21 | 2 | 7 | 0.0 | 普通自然 | `/rise-run-calculator/` | https://www.blocklayer.com/riserun |
| `hip roof rafters` | 320 | 9 | 3 | 6 | 0.0 | 普通自然 | `/hip-rafter-calculator/` | https://www.blocklayer.com/roof/hipeng |
| `metric stairs` | 480 | 16 | 4 | 6 | 0.0 | 普通自然 | `/stair-calculator/` | https://www.blocklayer.com/stairs/straight |
| `run rise angle calculator` | 140 | 19 | 4 | 6 | 0.0 | 普通自然 | `/roof-pitch-calculator/` | https://www.blocklayer.com/riserun |
| `spiral staircase calculator` | 260 | 11 | 1 | 64 | 5.57 | 普通自然 | `/spiral-staircase-calculator/` | https://www.blocklayer.com/stairs/spiral-stairseng |
| `gambrel roof calculator` | 480 | 5 | 2 | 31 | 3.01 | 普通自然 | `/gambrel-roof-calculator/` | https://www.blocklayer.com/roof/gambrel |
| `spiral stair calculator` | 110 | 13 | 1 | 27 | 5.57 | 普通自然 | `/spiral-staircase-calculator/` | https://www.blocklayer.com/stairs/spiral-stairseng |
| `gambrel truss calculator` | 260 | 9 | 3 | 11 | 2.49 | 普通自然 | `/gambrel-roof-calculator/` | https://www.blocklayer.com/roof/gambrel |
| `gambrel calculator` | 140 | 9 | 2 | 11 | 2.22 | 普通自然 | `/gambrel-roof-calculator/` | https://www.blocklayer.com/roof/gambrel |
| `spiral stair plans` | 70 | 12 | 1 | 9 | 2.79 | 普通自然 | `/spiral-staircase-calculator/` | https://www.blocklayer.com/stairs/spiral-stairseng |
| `spiral stairs calculator` | 30 | 18 | 1 | 7 | 5.25 | 普通自然 | `/spiral-staircase-calculator/` | https://www.blocklayer.com/stairs/spiral-stairseng |
| `gambrel roof truss calculator` | 320 | 3 | 3 | 7 | 2.53 | 普通自然 | `/gambrel-roof-calculator/` | https://www.blocklayer.com/roof/gambrel |
### Interior finish & cabinetry（20 词）
| 关键词 | Volume/月 | KD | 竞品排名 | 竞品估算访问/月 | CPC($) | 证据类型 | 归属 URL | 真实参考 URL |
|---|---:|---:|---|---:|---:|---|---|---|
| `crown molding calculator` | 390 | 9 | 1 | 96 | 0.0 | 普通自然 | `/crown-molding-calculator/` | https://www.blocklayer.com/crown-molding |
| `wainscoting calculator` | 1300 | 18 | 3 | 57 | 3.16 | 普通自然 | `/wainscoting-calculator/` | https://www.blocklayer.com/wainscotingeng |
| `crown molding angle chart` | 590 | 13 | 2 (图片) | 38 | 0.0 | 图片结果 | `/crown-molding-calculator/` | https://www.blocklayer.com/crown-molding |
| `crown moulding angles` | 210 | 16 | 2 | 17 | 0.49 | 普通自然 | `/crown-molding-calculator/` | https://www.blocklayer.com/crown-molding |
| `crown molding angles` | 590 | 16 | 2 | 14 | 0.59 | 普通自然 | `/crown-molding-calculator/` | https://www.blocklayer.com/crown-molding |
| `angle chart for crown molding` | 480 | 12 | 4 | 11 | 0.0 | 普通自然 | `/crown-molding-calculator/` | https://www.blocklayer.com/crown-molding |
| `crown moulding miter saw angles` | 170 | 10 | 2 | 11 | 0.0 | 普通自然 | `/crown-molding-calculator/` | https://www.blocklayer.com/crown-molding |
| `crown molding angle calculator` | 90 | 8 | 2 | 11 | 0.0 | 普通自然 | `/crown-molding-calculator/` | https://www.blocklayer.com/crown-molding |
| `crown molding angle` | 110 | 13 | 2 (图片) | 9 | 0.49 | 图片结果 | `/crown-molding-calculator/` | https://www.blocklayer.com/crown-molding |
| `crown molding cut chart` | 110 | 5 | 3 | 7 | 0.0 | 普通自然 | `/crown-molding-calculator/` | https://www.blocklayer.com/crown-molding |
| `wainscoting spacing calculator` | 90 | 15 | 3 | 7 | 0.0 | 普通自然 | `/wainscoting-calculator/` | https://www.blocklayer.com/wainscotingeng |
| `crown molding angle finder` | 390 | 14 | 2 | 7 | 0.36 | 普通自然 | `/crown-molding-calculator/` | https://www.blocklayer.com/crown-molding |
| `crown moulding angle chart` | 110 | 13 | 2 | 7 | 0.0 | 普通自然 | `/crown-molding-calculator/` | https://www.blocklayer.com/crown-molding |
| `angle finder for crown moulding` | 320 | 13 | 2 | 7 | 0.0 | 普通自然 | `/crown-molding-calculator/` | https://www.blocklayer.com/crown-molding |
| `crown molding miter angles` | 260 | 15 | 2 | 6 | 0.0 | 普通自然 | `/crown-molding-calculator/` | https://www.blocklayer.com/crown-molding |
| `crown molding angles chart` | 260 | 9 | 3 | 6 | 0.0 | 普通自然 | `/crown-molding-calculator/` | https://www.blocklayer.com/crown-molding |
| `shelf spacing calculator` | 140 | 5 | 1 | 34 | 0.0 | 普通自然 | `/shelf-spacing-calculator/` | https://www.blocklayer.com/shelf-spacingeng |
| `calculate shelf spacing` | 90 | 6 | 1 | 22 | 0.0 | 普通自然 | `/shelf-spacing-calculator/` | https://www.blocklayer.com/shelf-spacingeng |
| `calculate shelving space` | 110 | 5 | 1 | 14 | 0.0 | 普通自然 | `/shelf-spacing-calculator/` | https://www.blocklayer.com/shelf-spacingeng |
| `shelf bracket spacing calculator` | 90 | 0 | 1 | 7 | 0.0 | 普通自然 | `/shelf-spacing-calculator/` | https://www.blocklayer.com/shelf-spacing |
### Woodworking fabrication（22 词）
| 关键词 | Volume/月 | KD | 竞品排名 | 竞品估算访问/月 | CPC($) | 证据类型 | 归属 URL | 真实参考 URL |
|---|---:|---:|---|---:|---:|---|---|---|
| `kerf bending calculator` | 210 | 6 | 1 | 52 | 0.0 | 普通自然 | `/kerf-bending-calculator/` | https://www.blocklayer.com/kerf-spacingeng |
| `kerf calculator` | 210 | 4 | 1 | 52 | 0.0 | 普通自然 | `/kerf-bending-calculator/` | https://www.blocklayer.com/kerf-spacingeng |
| `kerf cut calculator` | 210 | 6 | 1 | 52 | 0.0 | 普通自然 | `/kerf-bending-calculator/` | https://www.blocklayer.com/kerf-spacingeng |
| `kerf bend calculator` | 210 | 6 | 1 | 52 | 0.0 | 普通自然 | `/kerf-bending-calculator/` | https://www.blocklayer.com/kerf-spacingeng |
| `how to bend a plywood` | 260 | 25 | AI 概览 | 15 | 0.0 | AI概览 | `/kerf-bending-calculator/` | https://www.blocklayer.com/kerf-spacingeng.aspx |
| `kerf spacing calculator` | 50 | 1 | 1 | 12 | 0.0 | 普通自然 | `/kerf-bending-calculator/` | https://www.blocklayer.com/kerf-spacingeng |
| `kerf bending` | 260 | 23 | 2 | 6 | 0.0 | 普通自然 | `/kerf-bending-calculator/` | https://www.blocklayer.com/kerf-spacing |
| `kerfing wood` | 320 | 25 | 3 | 6 | 0.0 | 普通自然 | `/kerf-bending-calculator/` | https://www.blocklayer.com/kerf-spacing |
| `segmented bowl calculator` | 260 | 17 | 1 | 64 | 0.0 | 普通自然 | `/segmented-bowl-calculator/` | https://www.blocklayer.com/woodturning-segmentseng |
| `bowl segment calculator` | 210 | 5 | 1 | 52 | 0.0 | 普通自然 | `/segmented-bowl-calculator/` | https://www.blocklayer.com/woodturning-segmentseng |
| `equal spacing calculator` | 480 | 7 | 4 | 31 | 0.0 | 普通自然 | `/equal-spacing-calculator/` | https://www.blocklayer.com/centers-spacingeng |
| `segment calculator` | 210 | 19 | 2 | 27 | 0.0 | 普通自然 | `/segmented-bowl-calculator/` | https://www.blocklayer.com/woodturning-segmentseng |
| `hole spacing calculator` | 110 | 4 | 1 | 27 | 0.0 | 普通自然 | `/hole-spacing-calculator/` | https://www.blocklayer.com/hole-spacing/single-roweng |
| `spacing calculator` | 320 | 15 | 4 | 20 | 0.0 | 普通自然 | `/equal-spacing-calculator/` | https://www.blocklayer.com/centers-spacingeng |
| `even spacing calculator` | 480 | 12 | 4 | 16 | 0.0 | 普通自然 | `/equal-spacing-calculator/` | https://www.blocklayer.com/centers-spacingeng |
| `evenly spaced calculator` | 210 | 3 | 4 | 13 | 0.0 | 普通自然 | `/equal-spacing-calculator/` | https://www.blocklayer.com/centers-spacingeng |
| `coopering calculator` | 50 | 8 | 1 | 12 | 0.0 | 普通自然 | `/segmented-bowl-calculator/` | https://www.blocklayer.com/woodturning-segmentseng |
| `evenly spacing calculator` | 390 | 14 | 5 | 9 | 0.0 | 普通自然 | `/equal-spacing-calculator/` | https://www.blocklayer.com/centers-spacingeng |
| `pointing calculator` | 1900 | 15 | 13 | 9 | 2.91 | 普通自然 | `/equal-spacing-calculator/` | https://www.blocklayer.com/centers-spacingeng |
| `calculator center` | 110 | 14 | 2 | 7 | 0.0 | 普通自然 | `/equal-spacing-calculator/` | https://www.blocklayer.com/centers-spacing |
| `center calculator` | 110 | 6 | 4 | 7 | 0.0 | 普通自然 | `/equal-spacing-calculator/` | https://www.blocklayer.com/centers-spacing |
| `stave calculator` | 90 | 10 | 2 | 11 | 0.0 | 普通自然 | `/stave-calculator/` | https://www.blocklayer.com/tapered-staveseng |
### Materials & cost（2 词）
| 关键词 | Volume/月 | KD | 竞品排名 | 竞品估算访问/月 | CPC($) | 证据类型 | 归属 URL | 真实参考 URL |
|---|---:|---:|---|---:|---:|---|---|---|
| `price per thousand calculator` | 110 | 9 | 2 | 14 | 0.0 | 普通自然 | `/lumber-price-calculator/` | https://www.blocklayer.com/lumber-price |
| `price per thousand calculator lumber` | 140 | 4 | 2 | 11 | 0.0 | 普通自然 | `/lumber-price-calculator/` | https://www.blocklayer.com/lumber-price |
## 7. 明确排除与机会保留
- 原始 400 行中 197 条被标记 `HOLD`（可能有其他独立网站价值，但与本项目垂直主题不匹配）；22 条标记 `EXCLUDE`（品牌或首页泛词）；181 条落在木工/尺寸/排布范围内。以上为**记录数**，并非不重复关键词数。
- 值得另案保留的示例：`rebar calculator` 4,400/月 KD 23（钢筋混凝土）；`tire comparison calculator` 2,400/月 KD 7（汽车）；`pipe coping template` 260/月 KD 20（金属加工）。这些是后续其他站点的线索，不应该混进木工站。
- 与你现有项目易重复的：`psig to kpa`、`grid paper printable pdf`、`protractor printable`、`cone template`；倾向暂缓或做指向单独工具的内部导航，不重复构建独立站。
- 因为 KD≥30 不作为新站主攻：`stair calculator` Volume 22,200 / KD 34、`tire size calculator` KD 63、`right triangle calculator` KD 46 等不进入主关键词列表。高 KD 词可自然出现在准确说明中，但不专门建立索引页抢其排名。
## 8. UI/UX：不是通用 SaaS 营销首页，而是专业“尺寸计算工作台”
**布局：** PC 端左侧为有单位切换和实时校验的输入面板，中间 SVG 实时尺寸图，右侧为材料清单/切角/结果/打印按钮；移动端顺序为输入→关键结果→图纸→导出，所有输入在触屏可编辑。
**设计语言：** 暖灰白背景、深绿与木材浅棕点缀、清晰尺规线、固定宽度数字、木工尺寸标注；避免仿制竞品视觉。首页以 5–6 个任务目录、真实工具卡片与近期使用（仅用户本地存储）为主。
**有目的的轻动画：** 输入后尺寸线平滑更新、材料行高亮、移动端折叠过渡、工具卡 hover；不进行持续动画或大型背景视频，尊重 reduced-motion。
**专业差异化：** 英寸分数显示（1/16、1/32 可选）、英制/公制双向准确换算、标注尺寸的 SVG、CSV 材料清单、PDF 打印视图。1:1 打印模板必须含校准刻度和 100% scale 提示，不随浏览器静默缩放。
## 9. 内容、技术 SEO 与 GEO 搜索设计
- 每个工具页的原始 HTML 必须包含：清晰 H1、一句话用途、输入和输出解释、计算过程/公式、可核算示例、单位与容差、适用边界、相关工具和可打印说明。JS 用于交互，不负责向搜索引擎提供唯一正文。
- Title 与 Description 一页一套；primary keyword、相关同义词、图纸/切割特点自然融入内容，不反复堆砌关键词。
- 可索引页面：必须通过 P0/P1 的准确性、移动端、图纸与独立任务价值检验。下载文件、不变更主题的尺寸参数、排序/filter 页面不索引。
- Sitemap、canonical、robots 在**正式自有域名确定后**生成；预览域名或 Pages 临时地址默认 `noindex`，不能凭空写一个假的正式域名或错误的 hreflang。
- JSON-LD 使用真实符合可见内容的 `WebSite`、适合的 `WebApplication`；不凭空添加作者、公司、奖项、评论、日期或可触发特殊展示的假 FAQ。GEO 的重点是**可引用、可复核的公式与实例**，不依赖所谓 AI 搜索专属捷径。
- 不引入需要每日更新的法律/规范表；安全相关声明必须与实际功能匹配。对真实建筑尺寸的推荐值必须可溯源，不能把纯几何结果标注为合规值。
## 10. 技术架构与零固定 API 成本
- **优先沿用本地已有原型：** Python 静态页面生成（`build.py`）+ ES Modules 的纯 JS 计算函数 + 原创 SVG + Cloudflare Pages；无需把小站强行改写成重量级全栈。若需要组件化大规模扩页，才评估 Astro SSG。
- 工具计算逻辑独立为纯函数，每个函数至少有常规测试与零值、负值、单位换算、极大值、误差上限和几何退化情形；前端从函数产出结构化结果再渲染图纸/清单。
- 用户数据原则上留在浏览器；无需登录、数据库、私有 API、上传到云端。若后期加广告、分析、错误监控，隐私政策必须反映真实请求/存储行为。
- 静态资源服务在免费托管允许范围内；CDN 字体、收费 AI、外部地图、验证码或托管数据库均非前置条件。
## 11. 与已创建 9 工具原型的差距（不可把“有页面”当“已完成”）
| 原型旧路由 | 处理 | 依据 |
|---|---|---|
| `/stud-calculator/` | 原型已有基础功能；升级后再索引 | 新导出关键词与实际竞品用途 |
| `/framing-calculator/` | 原型未覆盖门窗开口；必须升级 | 新导出关键词与实际竞品用途 |
| `/rafter-calculator/` | 原型只有斜线长度；须补切口 | 新导出关键词与实际竞品用途 |
| `/deck-board-calculator/` | 原型已有简化直排；须补排板 | 新导出关键词与实际竞品用途 |
| `/baluster-spacing-calculator/` | 原型基础功能；须补间距选项 | 新导出关键词与实际竞品用途 |
| `/crown-molding-calculator/` | 原型仅有角度幅值；须补方向 | 新导出关键词与实际竞品用途 |
| `/soffit-calculator/` | 新建 | 新导出关键词与实际竞品用途 |
| `/kerf-bending-calculator/` | 新建 | 新导出关键词与实际竞品用途 |
| `/wainscoting-calculator/` | 新建 | 新导出关键词与实际竞品用途 |
| `/stair-calculator/` | 原型简化版；P1 升级 | 新导出关键词与实际竞品用途 |
| `/hip-roof-calculator/` | 原型简化版；P1 升级 | 新导出关键词与实际竞品用途 |
| `/pulley-calculator/` | 建议改为不索引的旧原型，不纳入木工核心矩阵 | 新导出关键词与实际竞品用途 |
其余新增 P0/P1 工具需新建，现有原型的 12 个数值单元测试只是起点，不能代替每工具的公式基准、浏览器测试和打印校准。**V3.0 本次进一步升级研究与工程开发规范文件，没有改动生产网站，也没有提交 GitHub 或部署 Cloudflare。**
## 12. 开发完成定义与上线验收
1. **产品功能：** P0 全部可用且正确；选定 P1 真正满足截图中的意图；P2 不成熟的保留规划但不索引。各工具输入有合理单位、数值范围、默认样例、异常提示。
2. **真实图纸与导出：** SVG 的比例和尺寸有一致映射，图上数值可复算；TXT/CSV 有正确表头，PDF/打印为无截断、无广告干扰的纸张布局，提供 scale ruler。
3. **独立测试：** 所有纯函数、英公制换算、切角方向、边界处理、浮点舍入，关键工具以独立手算/权威几何参考核验。多组 golden fixtures。
4. **浏览器与 UI：** Chrome Desktop + 常用移动端宽度、键盘焦点、ARIA、视口不横向溢出、Dark / Light 可读性、reduced motion、低速网络首屏可用。
5. **SEO/GEO：** 原始 HTML 有工具内容、无孤儿页、每页唯一 H1/Title/canonical、结构化数据与实际一致、全站内链、sitemap 不包含 noindex、robots 与 canonical 不冲突。
6. **真实发布：** 选择实际自有 `.com` 域名后再切换为 index；访问正式 https 域名核查 200 状态、robots、favicon、sitemap、GSC 与站点验证。
7. **结果监控：** 保存投产时关键词与 URL 基线；2/4/8 周检查 GSC 展现、点击、收录、长尾查询、异常页；尚未获得数据前不虚构排名或广告收益。
## 13. 研究证据与后续不能冒称完成的事项
- 用户真实数据：上传的 400 行 Semrush `blocklayer.com` 自然搜索排名明细，截图与原始文本；原始数据完整性保留在 `blocklayer-400rows-classified.csv`。
- 官方竞品具体功能验证：
  - 斜墙立柱：https://www.blocklayer.com/gable-studs
  - 带开口墙体：https://www.blocklayer.com/wall-framing-openings
  - 椽木与切口：https://www.blocklayer.com/roof/raftereng
  - 露台布局：https://www.blocklayer.com/deckcalculatoreng
  - 锯缝弯木：https://www.blocklayer.com/kerf-spacingeng
  - soffit：https://www.blocklayer.com/roof/soffit-drop
  - 分段木碗：https://www.blocklayer.com/woodturning-segmentseng
- 项目开发标准：https://github.com/chenmu2024/Website-Starter-Standard（`BUILD-INTAKE-CONTRACT.md`、`SEO-GEO-PROJECT-BRIEF.md`、`TRUST-AND-STRUCTURED-DATA-GATE.md`）。
- **待确认：** 竞争者实际收入、广告 RPM、Google SERP 竞争者域名强度、完整 Semrush 9,470 词、GA 实际流量、正式域名与部署环境；无这些数据不影响开发立项，但不能编造收益预测。
## 14. 本研究交付的文件
- `Woodworking_Calculator_完整建站方案_V2_20261104.md`：此前数据底稿；当前版本保留原始证据。
- `wood-keywords-KD29-selected.csv`：152 条去重适用词，逐条保留 Volume、KD、原始排名、估算流量、CPC、实际竞品 URL、规划 URL。
- `wood-intent-route-summary.csv`：31 个意图与拟议 URL、关键词数量、示例流量贡献。
- `wood-in-scope-all-KD.csv`：含 KD≥30 的 169 个木工相关词，供布局内容与观察用。
- `blocklayer-400rows-classified.csv`：完整 400 行原始数据加分类与淘汰理由；用于后续追踪与校验。
- `Woodworking_SEO_Keyword_Research_20261104.xlsx`：多工作表的可筛选分析数据。

---
## 15. V3.0 最终工程交接合同（不可跳过）
- **目标/源文件：** 数据源为用户提供的 Blocklayer Semrush 400 行文件；原始 CSV、完整 152 关键词、31 意图矩阵作为批准的 research handoff。实际公开数据限于所提供样本，不能宣称全站完整覆盖。
- **严格范围：** 核心 9 个 P0、完整 17 个 P1；P2 5 个保留为审批后独立需求，避免以“做完 31 个路由”等同“31 个都可发布”。
- **冻结规则：** KD≤29（包含 29）、美国英语、纯前端、无付费 API、域名未确定之前只构建预览，不写假 canonical。
- **一词一意图：** 同义词绑定到唯一规范 URL；`stud calculator` 斜墙切长 vs `wall stud calculator` 普通立柱计数保持明确区分。英/公制不分别创建 SEO 索引 URL。
- **验收状态：** 必须记录 PASS / FAIL / NOT RUN / N/A。源码静态存在不等于浏览器点击实测完成；有未通过 P0/P1 的页面不得被索引。
- **不做：** 汽车轮胎、摩托车、结构承重设计、实际规范符合性承诺、未经校验的圆锯刀具安全/负荷规格、免费 API 以外任何服务。

## 16. 全部 31 个工具的逐项可执行规格
> 下表的“算例”是工程核对规则，非全部测试集。每个已批准发布的工具还需正常、临界、零/负值、英制小数分数、公制、随机差分、打印 100% 校准等自动化用例；复杂几何需两套独立实现或权威手册算例相互交叉验证。
| 优先级 | 规范 URL | 必需输入 | 算法/确定性规则 | 结果 | 核对算例与发布门槛 | 注意事项 |
|---|---|---|---|---|---|---|
| P0 | `/baluster-spacing-calculator/` | Clear opening, baluster face width, target maximum gap, end-gaps policy | n=ceil((L−g)/(w+g)); equalGap=(L−nw)/(n+1), configurable end gaps | n, center coordinates, gap dimensions, SVG | L=96,w=1.5,g=4 ⇒ n=17, gap≈3.9167in | Geometric spacing ≠ safety or building-code certification |
| P0 | `/crown-molding-calculator/` | Spring angle, wall corner, internal/external, left/right, saw orientation | miter=atan(sin(spring)/tan(corner/2)); bevel=asin(cos(spring)cos(corner/2)) under defined convention | signed miter/bevel and front-facing orientation diagram; printable cut reference | spring38°,corner90° ⇒ miter31.62°, bevel≈33.86° | Require physical scrap-test; clearly specify angle convention |
| P0 | `/deck-board-calculator/` | Deck width/length, board net width, spacing, stock lengths, waste, direction | N=ceil((W+gap)/(boardWidth+gap)); lastWidth=W−(N−1)(boardWidth+gap); stock optimization bounded | board count, last width, lineal footage, SVG layout, CSV | W=120,b=5.5,g=0.125 ⇒ N=22, last strip=1.875in | No automatic joist span/load recommendations |
| P0 | `/framing-calculator/` | Wall length, OC, thickness, multiple door/window intervals, framing toggles | Generate nominal OC grid; exclude studs inside openings; insert labelled king/jack layout only with explicit user-defined geometry | stud coordinates, opening rectangles, nonstructural cutlist | 120in wall, 16in OC, opening 32–68in ⇒ no routine infill stud inside opening; check boundaries | Never calculate header structural sizing or imply code compliance |
| P0 | `/kerf-bending-calculator/` | Target bend radius, material thickness, retained web, saw kerf width, desired angle | Arc length=R·θ; proposed kerf coordinates via geometric fit; empirical bend springback is not mathematically guaranteed | cut-count/spacing estimate, print-scale guide, mandatory scrap-test notice | R=100mm, θ=π/2 ⇒ arc length≈157.08mm | No claim of precise bending behavior across different woods |
| P0 | `/rafter-calculator/` | Building span/run, rise:12 or degrees, ridge thickness, overhang, stock depth, seat/plumb definitions | run adjusted for ridge; rise=run·pitch/12; line=sqrt(run²+rise²); cut geometry computed against fixed datum | common rafter profile, seat/plumb cuts, dimension table, full-size reference | run=120,pitch6:12 ⇒ rise60,line≈134.164in; near-degenerate ridge returns error | Birdsmouth cannot exceed usable section; engineering load/span excluded |
| P0 | `/soffit-calculator/` | Rafter pitch, eave horizontal projection, fascia/reference offsets, material thickness | Reference-line drop=horizontalProjection·pitch/12; layer offsets applied on named reference planes | soffit drop and segment lengths with labelled roof cross-section | 6:12 overhang=24in ⇒ nominal drop12in BEFORE offsets | No structural eave sizing; do not silently mix reference planes |
| P0 | `/stud-calculator/` | Slope wall length, start height, pitch, OC spacing, plates, datum | h(x)=h0+x·pitch/12; netCut=h(x)−plate deductions; enumerate endpoints | position/actual length and top-cut-angle row; annotated gable SVG | L=144, h0=96, 6:12 ⇒ theoretical end height 168in; subtract plates once only | Separate raked/gable stud lengths from generic wall counts |
| P0 | `/wainscoting-calculator/` | Wall length, side margins, panels count/target width, rail/stile, gap, exclusions | usableWidth=wallWidth−2margins−framing deductions; solve panel widths / gaps under chosen design | panel schedule, material list, SVG elevations | 120in width, 5 panels, 3in side margins, four 2in gaps ⇒ panel width21.2in | Panel layout geometry only, avoid false material standards |
| P1 | `/deck-material-calculator/` | Deck footprint, board width/length, gap, framing layout, fastener cost assumptions | area+ordered board takeoff; cost=sum(q_i p_i), stock optimization explicitly bounded | total board/fastener/material estimates and layout assumptions | 10×12ft rectangle ⇒ 120ft² area before trim | Never label joist span recommendations as structurally safe |
| P1 | `/diagonal-brace-calculator/` | Clear horizontal/vertical distances, end setbacks, material breadth | cut length=hypot(dx,dy); angle=atan2(dy,dx); user-specified end-cut datum | brace length, endpoint coordinates, angle SVG | 3ft×4ft ⇒ 5ft diagonal | Bracing geometry only, no forces |
| P1 | `/equal-spacing-calculator/` | Total distance, item width, count, outer offsets, reference center/edge | Inclusive center spacing=(L−left−right)/(N−1); clear gaps account for item widths | dimensioned coordinate/spacing table and SVG ruler | 1000mm length, 6 centers incl endpoints ⇒ 200mm pitch | N=1 requires explicit single-object placement policy |
| P1 | `/fence-post-calculator/` | Run length, target bay spacing, post thickness, corners/gates, endpoints | nBays=ceil(L/targetBay), posts=nBays+1 for single run, adjust at shared corners | post count/centers and SVG plan | L=100ft, max 8ft between posts ⇒ 13 bays,14 endpoints | Not a footing/fence wind-load specification |
| P1 | `/gable-roof-calculator/` | Width, length, ridge height or slope, overhang | run=width/2; rise=run*pitch; sloped line=hypot(run,rise); roof area=2line×length | gable roof schematic, area and dimensions | width=240in, pitch6:12 ⇒ rise60in, line134.164in | No structural snow/wind load parameters |
| P1 | `/hip-rafter-calculator/` | Roof footprint, common pitch, ridge assumption, diagonal bay geometry | hip horizontal run=hypot(plan offsets); rise from common run; hip line=hypot(planRun,rise) | hip line/angle; diagonal framing diagram | equal plan offsets120in, pitch6:12 ⇒ hip line≈180in | Do not infer truss/structural design |
| P1 | `/hip-roof-calculator/` | Hip roof plan polygons, roof pitch, sheathing panel specs, waste direction | Generate separate roof-plane polygons; perform planar clipping/packing on each plane | cut sheets and roof plane SVG, material takeoff, print template | Each plane must conserve area within geometric tolerance | More than diagonal length; verify polygon clipping and panel rotations |
| P1 | `/hole-spacing-calculator/` | Stock length, hole count, hole diameter, edge setback, pattern count | availableCenters=L−2setback; pitch=availableCenters/(n−1) | center coordinates, spacing, ruler marks, scalable print | L=100mm, 4 holes, offsets5mm ⇒ 30mm pitch | Ensure holes do not overlap or exceed board bounds |
| P1 | `/rise-run-calculator/` | Any two of rise, run, slope ratio, angle | pitch=rise/run; θ=atan(pitch); hypotenuse=hypot(rise,run) | slope angle, ratio, length and example | rise36in,run72in ⇒ 6:12, θ≈26.565° | Reject zero run and conflicting overdetermined fields |
| P1 | `/roof-pitch-calculator/` | Rise/run, pitch x:12, degrees, percent grade | θ=atan(rise/run); pitch12=12rise/run; percent=100rise/run | interchangeable representations and slope triangle | 6:12 ⇒ 26.565°, 50% grade | Do not cross-index same result on rise/run and pitch pages |
| P1 | `/roof-sheathing-calculator/` | Roof plane sizes, pitch, sheets, orientations, edge offsets, waste | Geometry gives real sloped area; optional 2D sheet nesting with explicit seam assumptions | panel count, cut placement and waste | 120ft² single plane / 32ft² sheet ⇒ mathematical lower bound4 sheets | Actual sheet count may exceed area lower bound |
| P1 | `/segmented-bowl-calculator/` | Ring outside diameter, inside diameter, segments per ring, number of rings | segment wedge angle=180°/n; outerChord=2R sin(π/n), inner similarly | tapered segment dimensions, ring SVG, printable cut angles | n=12 ⇒ each end miter15° | Allow finite stock thickness, distinguish raw blank from finished dimensions |
| P1 | `/shelf-spacing-calculator/` | Interior height, number of shelves, shelf thickness, top/bottom clearance | gaps=(H−n*t−fixed offsets)/(n+1), unless end policy changes | exact shelf locations, hole drilling grid, SVG cabinet | H=1000mm,n=3,t=20 ⇒ four clear gaps235mm | Negative clearances invalid |
| P1 | `/square-layout-calculator/` | Rectangle side lengths, measured diagonals, adjustment measurements | idealDiagonal=hypot(a,b); compare both measured diagonals; 3-4-5 layout | diagonal difference; field marking coordinates | 3ft×4ft rectangle ⇒ diagonal5ft | Diagonal equality alone does not prove squareness for arbitrary quadrilateral |
| P1 | `/stair-calculator/` | Total vertical rise, preferred maximum step rise, tread run, upper landing policy | risers=ceil(totalRise/preferredRise); actualRise=totalRise/risers; treads=risers−1 unless terminal convention differs | straight stair elevation, rise/run and step markers | 105in total / 7.5in desired ⇒ 14 risers and 13 treads | No headroom/guardrail/building compliance certification |
| P1 | `/stair-stringer-calculator/` | Rise/run/treads, stock section, landing geometry, nose reference | Compute repeated cut coordinates for each step, translate to stock; constraints on residual wood require user review | true cutline polygon, reference measurements, print sheet | 105in rise/14 risers ⇒ 7.5in each; 13 ×10in treads =>130in run | Dedicated straight stringer; spiral competitor URL was mismatched |
| P1 | `/wall-stud-calculator/` | Wall length, OC spacing, end studs, plate length assumptions | grid x=0,s,2s,…,L with endpoint dedup; optional end packs tracked separately | count and locations; cutlist; SVG | 120in at 16in OC ⇒ positions 0,16,…,112,120 =9 | Separate from /stud-calculator/ gable lengths |
| P2 | `/fence-picket-calculator/` | Span, picket width, preferred gap, end constraints | n=ceil((L−g)/(w+g)); clear gap solve with end policy | picket count, coordinates, visualization | 96in run, w3.5in, gap2in ⇒ n=18, clear gap≈1.7368in | Distinguish picket from baluster despite similar math |
| P2 | `/gambrel-roof-calculator/` | Halfspan, lower/upper slope and break point, building length | Two slope segments joined continuously, compute heights/lengths separately | roof section, segment measurements, area | Verify heights equal at joined point; mass balance across both sides | Gambrel geometry, not truss sizing |
| P2 | `/lumber-price-calculator/` | Board length/width/thickness, BF rate, qty, tax/waste user-defined | BF=(T[in]×W[in]×L[ft])/12; cost=BF×rate×qty | board feet, line item cost, CSV export | 1×6×8ft nominal ⇒4 board feet; actual dressed sizes must be clearly distinct | Explicit nominal vs actual measurement |
| P2 | `/spiral-staircase-calculator/` | Inner/outer radii, turn angle, total rise, number steps, walkline | rise=N denominator, angularStep=totalTurn/N, walklineTread=Rwalk·angularStep(rad) | riser, walking path, printable plan view | turn360°, N=12 ⇒ 30° per step | Complex safe headroom/handrail code excluded |
| P2 | `/stave-calculator/` | Top/bottom diameters, height, stave count, stock thickness | Two polygon circumferences; segment taper and bevel calculated from polygon/prism geometry | tapered stave flat pattern and miter angle | n=12 circular approximation ⇒ 15° half-wedge | Physical bevels depend on thickness and profile; verify reference fixture |

## 17. 真正的 UI 设计系统与页面组件合同

### 17.1 设计参照（研究逻辑，不复制样式）
1. **Blocklayer 真实操作页：** 参考工业图纸的信息密度、可打印尺寸表、参考面标签；不要复制图像和源代码。
2. **Desmos 类工具交互逻辑：** 关注输入后即时反馈、图形与结果一致性，不复制其品牌视觉。
3. **传统 CAD 尺寸标注：** 尺寸箭头、基准线、明确 in/mm、视图方向；避免“漂亮但不能用于加工”的示意图。

### 17.2 固定 Design Tokens / 交互原则
- 颜色：背景 `#F8F7F4`、主文本 `#1F2925`、主交互 `#1E6454`、强调 `#C58C54`、辅助 `#64736C`、危险 `#A83A33`；必须验证 WCAG 对比度，具体色值可在真实 UI 视觉审查中调整。
- 字体：系统字族 + `font-variant-numeric: tabular-nums`，数字不发生左右跳动；不引入 Google Fonts 网络依赖。
- 桌面 1280px 及以上：24rem 左侧输入、可缩放中部 SVG、18rem 右侧结果（内容不足时允许双栏）；1024px 及以下自动切为两栏；≤768px 必须按 **输入 → 关键结果 → 图纸 → 下载 → 计算说明** 排序。
- 每页固定组件：`ToolHero`、`InputField`、`UnitToggle`、`DimensionCanvas`、`ResultSummary`、`CutList`、`FormulaProof`、`RelatedTools`、`PrintSheet`、`ErrorState`、`SourceNotes`。
- 图纸：尺寸单位标签写在 SVG 内，不用仅靠 hover 提示；支持鼠标缩放、键盘放大缩小、重置视图；保留对比度较好的图例。
- 动效只在数据变动时触发，默认 160–220ms 以内，支持 `prefers-reduced-motion` 关闭；避免自动播放动画、连续 3D、视差背景和内容布局跳跃。
- 广告位只在真实内容后、相关工具列表附近引入，不应遮挡结果、切割图、移动端输入或打印；打印 CSS 必须隐藏广告。

## 18. SEO/GEO 精准发布矩阵与自动生成规则

- 每个合格工具必须有唯一 `title`、H1、Description、规范 URL、自解释初始 HTML；不得仅将空白 JS 容器送给爬虫。
- **Title 生成不是机械模板：** 例 `/stud-calculator/` → `Stud Calculator for Gable Walls – Cut Lengths & Layout`; `/rafter-calculator/` → `Rafter Calculator – Length, Pitch, Birdsmouth Reference`; `/deck-board-calculator/` → `Deck Board Calculator – Board Count, Gaps & Layout`。全部 31 项在交付时必须通过逐页审查。
- Description 必须描述真实可用功能，不得写尚未完成的 birds-mouth、sheet nesting、精确 1:1 模板或 PDF 导出。
- 功能相似页明确分工：`/rise-run-calculator/` 负责一般斜率；`/roof-pitch-calculator/` 负责 12-inch roof pitch；`/stair-calculator/` vs `/stair-stringer-calculator/`；`/hip-roof-calculator/` vs `/hip-rafter-calculator/`。
- `WebSite` 与真实可用的 `WebApplication` JSON-LD 足够；没有真实公司/评测/作者则不创建对应虚假结构化数据。GEO 重点是可提取定义、参数表、单位、例题、公式、适用范围、SVG 与替代文本，不虚构特殊 AI 搜索标记。
- 单一用户任务产生一个索引路由；数字输入组合、语言参数、导出图、纯实例页默认 **不单独索引**。所有索引页在 static build 必须有可读公式、至少一组可复算示例和有用输出解释。
- 域名未购买前 Cloudflare Pages 预览必须 `noindex`；配置生产域名后按真实 HTTPS 再生成 canonical、sitemap、robots，避免展示临时域名成为 Google 规范 URL。

## 19. 静态实现与模块划分

```text
src/
  content/tools.yaml         # 31 routes source of truth, status, main/secondary keywords
  calculators/*.ts           # pure deterministic formulas, type guards
  diagrams/*.ts              # SVG dimension geometry from computed result only
  components/{Inputs,Results,Diagram,Print,UnitSwitch}.*
  pages/{category}/{route}/  # SSG route without indexable parameter variants
  styles/{tokens,layout,print}.css
  seo/{metadata,schema,sitemap}.ts
  fixtures/*.json            # independent golden cases, units, edge cases
  tests/{unit,properties,print,e2e,seo}/*
```

- 为避免重写旧原型：可先复用已有 `wood-layout-site/assets/calcs.mjs` 中 9 个纯函数，但它们只是功能起点，其中 `framing`、`rafter`、`hipRoof` 缺少生产功能；不要把现有 12 个通过的测试当作完整验收。
- 构建以静态生成优先，功能交互纯 JS/TS；必要时引入 Astro SSG（不是强制），运行期不能要求数据库、用户账号、第三方付费服务。
- CSV、SVG、PDF 下载均使用用户浏览器本地生成，文件名包含工具 slug 与单位；CSV 使用 UTF-8 BOM 可选以便 Excel，值带单位与假设信息。
- 用户输入可本地保存 presets，但要允许一键清除；不采集儿童个人信息、不收集施工方项目地址；真实部署前审核广告/分析脚本是否传输数据，再写隐私政策。

## 20. 算法与可打印图纸验收（明确 PASS 标准）

| 类别 | 最低验收 | P0/P1 阻断条件 |
|---|---|---|
| 算法 | 每工具 ≥8 个自动化用例：典型/边界/退化/单位等价/异常；31 意图总目标 ≥210 个有效测试 | 任一 P0/P1 基准算例错误 |
| 图纸 | 图元统一世界坐标，数值与结果来自同一计算对象；标尺刻度数字可见 | 方向倒置、标注值错误、布局溢出 |
| 打印 | Letter 与 A4，浏览器 100% 实测校准，打印校准方形误差 ≤0.5%（校准不合格不得声称 1:1） | 实体尺寸误差不达标，打印被广告覆盖 |
| 设备 | Chrome Windows PC 与 360/390/768/1280/1440 CSS px 响应；表单可键盘操作 | 横向溢出、主操作不可达 |
| SEO | 静态原始 HTML 包含标题、说明、图纸替代文本、主关键词工具功能 | 未实现功能页进 sitemap；错误 canonical/noindex 冲突 |
| 工程安全 | 公开可复算的纯几何，不给受力/承重/法规合规保证 | 未核实数据被描述成工程许可尺寸 |
| 构建发布 | npm/pnpm lockfile + CI 运行完整 unit/e2e/static SEO 及构建；Cloudflare 预览验证 | 测试未运行却记 PASS，生产路径 404 |

**验收文件：** `SEO-GEO-RELEASE-EVIDENCE.md`、`UI-RELEASE-EVIDENCE.md`、`QA-EVIDENCE.md`；每条记录构建命令、测试报告、实际截图、预览 URL、检查日期、失败截图、修复提交 SHA。没有实际执行不能填 PASS。

## 21. 广告变现与收入证据纪律

- AdSense 采用真实批准后接入；从内容和可打印任务出发规划广告，优先工具结果下方与相邻模块，不将屏幕 50% 换成广告。
- Semrush CPC、流量价值只是**搜索广告市场价格**，不等于站长每点击广告获得收入；不能据此推导访问者价值。没有真实 RPM 时不预测收入。
- 若讨论情景：月会话数×假设 pageviews/session×假设 page RPM÷1000，所有 RPM 明确标记人为假设，不是已验证事实；站点真实数据上线后再更新。
- 目标发布后一站完成的维护：只看 GSC 索引/核心页面点击、错误监控、重大浏览器变化；不依赖更新官方建筑规范数值或付费 API。

## 22. 交付定义与当前客观状态

- 本文是研究/产品/技术开发合同，**未对 GitHub 进行任何代码提交、未产生生产网站**。
- 现存 `wood-layout-site` 只有九个简化函数与少量页面。V3 执行时先复用基础，再补齐所有 P0/P1 的真实算法和 UI；未验收页面不得索引。
- 将 152 关键词表原文保留于第 6 章，同时附 CSV 和 Excel 数据。P2 项目不是为了“补够数量”而勉强提前索引。


## 23. 木工 V3.0 跨模块一致性和计算误差纠正

- 31 个意图统一分配 9 P0、17 P1、5 P2；26 个 P0/P1 在本版被列为开发/验收范围，5 个 P2 只保留研究证据与规格。
- **纠错：** 露台板覆盖宽120in、板净宽5.5in、缝0.125in → 22 排，最后一排理论裁宽 **1.875in**；不得沿用早期 V2 误写的3.625in。所有独立算例都应有实际自动化用例复核。
- `stud calculator`（斜墙立柱切长）不同于 `wall stud calculator`（普通墙立柱数量）；`hip roof calculator`（屋面裁板）不同于 `hip rafter calculator`（屋脊斜线几何）；公英制用同一 URL，不要创造重复页。
- 图纸尺寸与清单一律取同一计算对象，专业切口、非矩形裁切和 1:1 打印图还需要独立几何与真实打印检查，不能因核心单元测试通过便算验收完成。
- 生产上线还需要真实域名/HTTPS canonical、响应式 Chrome 截图、SVG/打印校准、计算无效输入回退、SEO 原始 HTML、`sitemap.xml` 与 `robots.txt` 实测；预览域名 noindex。

## 24. 31 条 SEO 路由逐页标题与索引验收映射

附表 `SEO_ROUTE_METADATA_DRAFT_86.csv` 中按 `site=Woodworking` 筛选得到 31 条路由、主关键词、Volume、KD、竞品 URL、Title/H1/Description 草稿和发布门禁。Title/Description 是**未来页面开发规格**，不是目前线上存在的内容。P0/P1 均须真实通过功能+图纸+移动端+SEO 测试后将 `NOINDEX_UNTIL_FUNCTIONAL_QA` 改为可索引；P2 默认 HOLD。