
## PWA支持 + 每日提醒
- [x] PWA: 创建manifest.json（应用名、图标、主题色、启动方式）
- [x] PWA: 创建service worker（缓存策略、离线支持）
- [x] PWA: 生成PWA图标（192x192 + 512x512）
- [x] PWA: 注册service worker
- [x] PWA: 添加iOS安装引导提示
- [x] 提醒: 应用内每日提醒卡片（当天未记录时显示）
- [x] 提醒: 应用内提醒（时间问候+励志语+快捷跳转）
- [x] 测试验证
- [x] 保存检查点

## 系统推送通知提醒
- [x] 后端：定时检查用户当天是否已填写记录
- [x] 后端：未填写时调用通知API推送提醒
- [x] 数据库：添加通知设置表（开关、提醒时间）
- [x] 前端：通知设置页面（开关、提醒时间选择）
- [x] 测试验证
- [x] 保存检查点

## Web Push 浏览器推送通知
- [x] 安装web-push依赖，生成VAPID密钥对
- [x] 数据库：创建push_subscriptions表存储用户推送订阅
- [x] 后端：推送订阅管理API（订阅/取消订阅）
- [x] 后端：改造提醒调度器，使用web-push替代Manus通知
- [x] 前端：Service Worker添加push事件监听
- [x] 前端：通知设置页面添加推送授权按钮和状态显示
- [x] 测试验证
- [x] 保存检查点

## 新增"是否剧烈头痛"选项
- [x] 数据库：symptom_entries表添加severeHeadache布尔字段
- [x] 后端：API适配新字段
- [x] 前端：记录页面添加开关选项
- [x] 前端：历史和报告页面显示该字段
- [x] 测试验证
- [x] 保存检查点

## 常用药品自动补全
- [x] 后端：添加API获取用户历史用药列表（去重+频率统计）
- [x] 前端：药品名输入框添加自动补全下拉提示
- [x] 前端：用量输入框也根据对应药品历史用量提示
- [x] 前端：选择药品名时自动填充常用用量
- [x] 测试验证（49个测试全部通过）

## 统计页面趋势折线图
- [x] 前端：用Recharts绘制各症状评分随时间变化的折线图
- [x] 前端：支持选择显示哪些症状指标（9项可切换）
- [x] 前端：支持时间范围筛选（7/14/30/90天/全部）
- [x] 前端：头晕+头痛面积图
- [x] 前端：趋势变化指标卡片（上升/下降/持平）
- [x] 测试验证
- [x] 保存检查点

## 一键填入常用药方模板
- [x] 后端：基于历史用药频率自动识别常用药方组合（使用❥2次的药品）
- [x] 前端：在用药区域添加“常用药方”按钮（标题栏+空状态区域）
- [x] 前端：点击后自动填入最常用的药品+用量组合
- [x] 测试验证（60个测试全部通过）

## 症状周报/月报文字摘要
- [x] 前端：在统计页面趋势图下方添加文字摘要区域（可折叠）
- [x] 前端：自动生成本周/本月症状变化趋势的中文描述
- [x] 前端：包含各指标平均值、变化方向、关键发现、常见诱因、用药记录、综合评估
- [x] 前端：支持一键复制摘要文本
- [x] 测试验证

## CSV格式数据导出
- [x] 前端：在历史页面导出功能中增加CSV格式选项
- [x] 前端：CSV包含所有字段（14列：日期、9项症状、剧烈头痛、用药、诱因、备注）
- [x] 前端：支持中文表头，BOM编码兼容Excel打开
- [x] 测试验证

## 症状关联分析
- [x] 前端：分析特定诱因出现时各症状的平均评分（TriggerAnalysis已有）
- [x] 前端：对比有/无某诱因时的症状差异（展开卡片详细对比）
- [x] 前端：新增关联热力图视图（CorrelationHeatmap组件）
- [x] 测试验证（68个测试全部通过）

## 数据可视化增强
- [x] 前端：用药频率柱状图（Recharts水平BarChart，MedicationChart组件）
- [x] 前端：诱因词云/气泡图可视化（TriggerBubbleChart组件）
- [x] 前端：集成到统计页面（趋势tab+诱因分析tab）
- [x] 测试验证

## 就医报告增强
- [x] 后端：报告新增趋势分析章节（前后半段对比）
- [x] 后端：报告新增诱因-症状关联分析章节
- [x] 前端：报告页面已有完整生成+打印/PDF功能
- [x] 前端：PDF包含症状摘要、趋势分析、诱因统计、关联分析、用药记录、备注
- [x] 测试验证（report-enhanced.test.ts 8个测试通过）

## 症状日历视图
- [x] 前端：创建CalendarView月历组件（完整月历布局+前后月切换）
- [x] 前端：用颜色深浅标记每天综合症状严重度（绿→黄→橙→红）
- [x] 前端：点击日期可查看当天详情弹窗+跳转记录
- [x] 前端：集成到历史页面（列表/日历视图切换）
- [x] 测试验证（85个测试全部通过）

## 数据备份与恢复
- [x] 后端：导出所有用户数据为JSON的API（记录+自定义诱因+提醒设置）
- [x] 后端：从JSON文件恢复数据的API（支持新旧格式，upsert不会删除已有数据）
- [x] 前端：设置页面添加BackupRestore组件（导出+恢复+安全提示）
- [x] 测试验证

## 自定义症状指标
- [x] 数据库：新增custom_metrics和custom_metric_values表
- [x] 后端：完整CRUD API（列表/添加/更新/删除/获取值/保存值）
- [x] 前端：设置中CustomMetricsManager组件（添加/编辑/删除+评分方向选择）
- [x] 前端：记录页面CustomMetricSliders组件（自动加载+保存）
- [x] 测试验证（17个新测试通过）

## AI 智能分析
- [x] 后端：创建AI分析tRPC端点（ai.analyze mutation），调用invokeLLM对历史数据深度分析
- [x] 后端：构建结构化prompt，包含数据概览、均值、趋势对比、诱因频率、用药统计、明细表
- [x] 后端：返回Markdown格式分析报告（模式识别、诱因关联、用药评估、时间规律、个性化建议）
- [x] 前端：创建AIAnalysis组件（加载动画+结果渲染+复制+重试）
- [x] 前端：使用Streamdown渲染Markdown分析报告，带加载动画和错误处理
- [x] 前端：集成到统计页面第三个tab（趋势/诱因/AI分析）
- [x] 测试验证（96个测试全部通过，含11个AI分析测试）

## Bug 修复
- [x] 导出PDF界面（ReportView）添加返回按钮（“返回重新配置”）
- [x] 导出报告新窗口HTML页面添加顶部工具栏（返回主界面+打印/保存PDF，打印时自动隐藏）

## 症状预警通知
- [x] 数据库：新增alert_rules和alert_history表
- [x] 后端：检测连续多天某指标超过阈值的逻辑（支持above/below方向）
- [x] 后端：预警检查集成到记录保存后自动触发（非阻塞）
- [x] 后端：完整CRUD API（列表/创建/更新/删除规则+历史/未读计数/标记已读）
- [x] 前端：AlertSettings组件（规则管理+历史记录+未读徽标）
- [x] 前端：集成到提醒设置面板
- [x] 测试验证（120个测试全部通过，含24个新测试）

## 深色/浅色主题切换
- [x] 前端：配置深色模式CSS变量（.dark主题，暖色调深色背景）
- [x] 前端：导航栏添加月亮/太阳主题切换按钮
- [x] 前端：ThemeProvider启用switchable，主题选择保存到localStorage
- [x] 测试验证

## 多设备数据同步提示
- [x] 后端：添加sync.status API返回记录总数、最后更新时间、日期范围
- [x] 前端：SyncStatus组件（云端状态指示、记录总数、最后更新时间、日期范围）
- [x] 前端：手动刷新按钮+30s缓存策略
- [x] 前端：集成到设置面板顶部
- [x] 测试验证（134个测试全部通过）

## 快捷记录模式
- [x] 前端：QuickRecord组件（只显示选定的核心指标滑块）
- [x] 前端：支持自定义选择2-5个指标（配置保存到localStorage）
- [x] 前端：快捷保存后自动保留已有记录值或使用默认值
- [x] 前端：记录页面添加“完整记录/快捷模式”切换按钮
- [x] 测试验证

## Widget 快捷入口 — 今日概览卡片
- [x] 前端：TodayWidget组件（综合健康分+9项指标网格+昨日对比变化标签）
- [x] 前端：绿/黄/红颜色标注严重度，↑↓箭头标注改善/恶化，显示前4个最大变化
- [x] 前端：集成到记录tab顶部（仅当日期为今天时显示）
- [x] 测试验证（149个测试全部通过，含15个Widget测试）

## 快捷记录增强
- [x] 快捷记录模式添加“是否剧烈头痛”开关选项（Switch组件+警告图标）

## UI 调整
- [x] “快捷模式”改为“快捷记录”
- [x] 日期选择器移到模式切换按钮上方，两种模式共用同一个日期选择器

## 每日用药提醒推送
- [x] 数据库：新增medication_reminders表（药品名、剂量、提醒时间、启用状态、上次通知日期）
- [x] 后端：完整CRUD API（medReminders.list/add/update/delete）
- [x] 后端：定时调度器集成，每15分钟检查并按药品独立时间推送Web Push
- [x] 后端：每种药品使用独立tag避免通知覆盖，每日去重防止重复推送
- [x] 前端：MedicationReminders组件（添加/编辑/删除/启用切换+药品名自动补全+按时间分组）
- [x] 前端：集成到提醒设置面板（铃铛图标）
- [x] 测试验证（164个测试全部通过，含15个用药提醒测试）

## 用药提醒重复规则
- [x] 数据库：medication_reminders表添加repeatDays字段（JSON数组，存储周几0-6）
- [x] 后端：调度器检查当前星期几是否在repeatDays中（isDayActive函数）
- [x] 前端：添加周几选择器（支持"每天"/"工作日"/"周末"快捷按钮和单独选择）
- [x] 测试验证（199个测试全部通过，含35个新增测试）

## 用药依从性统计
- [x] 后端：新增依从性分析API（getMedicationAdherence，对比提醒记录和实际用药记录）
- [x] 后端：计算总体依从率、各药品依从率、每日服药情况
- [x] 前端：统计页面新增"依从"tab（MedicationAdherence组件，环形图+进度条+柱状图）
- [x] 测试验证

## 提醒时间微调
- [x] 数据库：medication_reminders表添加offsetMinutes和snoozedUntil字段
- [x] 后端：调度器计算实际提醒时间 = 设定时间 + offset（applyOffset函数）
- [x] 后端：稍后提醒API（snoozeMedicationReminder，推迟15分钟再次推送）
- [x] 前端：提醒编辑界面添加"提前/延后"选项（-60到+60分钟）
- [x] 前端：推送通知添加"稍后提醒"交互按钮
- [x] 测试验证

## 依从性提醒
- [x] 后端：检测连续多天漏服某药品的逻辑（getMissedMedicationAlerts）
- [x] 后端：集成到定时调度器，连续漏服≥3天时推送Web Push警告
- [x] 前端：首页显示漏服警告卡片（MissedMedicationAlert组件，红色警告+药品名+连续漏服天数）
- [x] 测试验证（241个测试全部通过，含42个新增测试）

## 药品库存管理
- [x] 数据库：medication_reminders表添加库存相关字段（stockQuantity/dailyDosageCount/stockAlertDays/lastStockAlertDate）
- [x] 后端：计算预计用完日期的API（getMedicationStockStatus）
- [x] 后端：集成到调度器，库存不足时推送补药提醒（checkAndSendLowStockAlerts）
- [x] 前端：用药提醒管理中添加库存设置（剩余数量+每日用量+提前提醒天数）
- [x] 前端：MedicationStock组件（库存状态卡片+进度条+快捷调整+低库存警告）
- [x] 测试验证

## 用药与症状关联分析
- [x] 后端：增强AI分析prompt，加入用药依从性数据和药品库存状态
- [x] 后端：analyzeSymptoms函数接受adherenceData和stockData参数
- [x] 后端：AI prompt新增"用药依从性与症状关联"分析要求
- [x] 前端：AI分析结果自动包含用药关联分析章节
- [x] 测试验证（241个测试全部通过）

## Bug: 用药提醒推送收不到
- [x] 排查服务器日志确认调度器是否正常运行
- [x] 检查Web Push订阅和推送逻辑
- [x] 修复问题并验证（原因：getUsersNeedingReminder查询报错导致整个检查函数中断，已改为独立 try-catch）

## Bug: 用药提醒时间选择器滑动后弹窗自动关闭
- [x] 排查时间选择器组件的交互逻辑（原因：iOS Safari原生<input type="time">滑动触发onChange导致重新渲染）
- [x] 修复：替换为自定义TimePicker组件（时/分列表选择+确认按钮）
- [x] 测试验证（241个测试全部通过）

## 导出用药提醒到系统日历
- [x] 前端：生成.ics日历文件（iCalendar格式，含VALARM+RRULE+时区）
- [x] 前端：列表顶部"导入日历"按钮（批量导出所有已启用提醒）
- [x] 前端：每个提醒卡片添加日历图标按钮（单个导出）
- [x] 测试验证（260个测试全部通过，含19个新增测试）

## 库存跟踪提醒导出到日历
- [x] 前端：根据库存数量和每日用量计算备药提醒日期（预计用完日 - 提前天数），生成.ics事件
- [x] 前端：MedicationStock组件顶部"全部导入日历"按钮 + 每个药品卡片"导入日历"按钮
- [x] 测试验证（270个测试全部通过，含10个新增库存导出测试）

## 设置页面重构
- [x] 创建SettingsView组件，包含用户信息卡片、登出、外观模式切换、提醒管理、数据管理
- [x] 底部导航新增"设置"tab（第5个tab）
- [x] 从顶部导航栏移除登录、黑暗模式、提醒、设置入口
- [x] 顶部导航栏精简为：logo + 记录条数
- [x] 测试验证（270个测试全部通过）

## 用药提醒与今日用药记录数据共享
- [x] 分析现有数据结构（medication_reminders表 vs symptom_entries.medications JSON）
- [x] 后端：新增 getTodayMedications API，根据日期和周几重复规则返回今日应服药品
- [x] 前端：今日用药区域新增"从提醒导入"按钮（智能去重，不会重复添加）
- [x] 前端：保存记录时自动扣减库存（仅新建记录时）
- [x] 测试验证（281个测试全部通过，含11个新增测试）

## 服药确认打卡
- [x] 后端：新增 confirmMedicationTaken API（记录用药到当日条目+扣减库存）
- [x] 后端：推送通知中添加"已服药"+"稍后提醒" action按钮，携带reminderId
- [x] 前端：Service Worker处理 confirm-taken 和 snooze action，调用后端API
- [x] 测试验证（302个测试全部通过）

## 用药时间线
- [x] 后端：新增 getMedicationTimeline API（返回每日各药品服药/漏服状态）
- [x] 前端：MedicationTimeline组件（日期行+药品列，绿色✓/红色✗标记）
- [x] 前端：集成到历史页面（新增"用药"视图模式）
- [x] 测试验证

## 药品说明书链接
- [x] 数据库：medication_reminders表添加instructionUrl字段
- [x] 后端：add/update接口支持instructionUrl
- [x] 前端：提醒表单添加说明书URL输入框，卡片中药品名旁显示FileText图标链接
- [x] 测试验证（302个测试全部通过，含21个新增测试）

## 服药打卡日历
- [x] 后端：新增服药打卡数据API（getMedicationCheckInCalendar，每日是否全部按时服药）
- [x] 前端：创建MedicationCheckInCalendar组件（月历视图+绿色/黄色/红色打卡标记+图例）
- [x] 前端：显示连续打卡天数和当月打卡率激励信息（奖杯图标+连续天数徽章）
- [x] 前端：集成到记录页面（今日概览卡片下方）
- [x] 测试验证（322个测试全部通过，含20个新增测试）

## Bug: 用药提醒输入框点击就关闭
- [x] 排查用药提醒组件中输入框点击后自动关闭的原因（ReminderFormFields在组件内部定义导致每次重新渲染重新挂载）
- [x] 修复输入框交互问题（提取ReminderFormFields为顶层组件+移除SettingsSection的AnimatePresence动画）

## 用药提醒整行删除功能
- [x] 在用药提醒列表中添加滑动删除功能（SwipeToDelete组件，左滑显示删除按钮+确认弹窗）

## 药品过期提醒
- [x] 数据库：medication_reminders表添加expirationDate和expirationAlertDays字段
- [x] 后端：更新add/update接口支持expirationDate和expirationAlertDays
- [x] 后端：调度器新增过期检测逻辑，临近过期时推送Web Push提醒
- [x] 后端：新增getExpiringMedications API查询过期状态
- [x] 前端：提醒表单添加过期日期选择器+提前提醒天数
- [x] 前端：提醒卡片显示过期状态（临近过期黄色/已过期红色警告+剩余天数）
- [x] 测试验证（343个测试全部通过）

## 打卡日历点击交互
- [x] 后端：新增getMedicationCheckInDayDetail API返回每日各药品的服药/漏服详情
- [x] 前端：DayDetailPanel组件，点击日历某天显示已服药品列表✓ + 漏服药品列表✗（含药品名+剂量）
- [x] 测试验证

## 批量编辑提醒
- [x] 后端：新增batchUpdateMedicationReminders API（批量修改时间/启用/禁用）
- [x] 前端：用药提醒列表添加批量编辑模式（多选复选框+全选+批量操作栏）
- [x] 前端：支持批量调整提醒时间（TimePicker+应用按钮）、批量启用/禁用
- [x] 测试验证（343个测试全部通过）

## Bug: 提醒用药与今日用药数据库未打通
- [x] 排查提醒药品(medication_reminders)与今日用药(symptom_entries.medications)的数据关系
- [x] 修复数据打通问题：在medications JSON中增加reminderId字段建立结构化关联
- [x] 统一药品匹配逻辑（medMatchHelper：buildEntryMedMap + wasMedTaken，优先reminderId匹配，回退名称匹配）
- [x] 更新打卡日历/依从性统计/时间线/日详情等所有匹配逻辑
- [x] 测试验证（371个测试全部通过）

## 药品分组管理
- [x] 数据库：新增medication_groups表（分组名、图标、颜色、用户ID、排序）
- [x] 数据库：medication_reminders表添加groupId外键关联
- [x] 后端：分组CRUD API（medGroups.list/create/update/delete/assign/grouped/confirmAll）
- [x] 后端：add/update提醒接口支持groupId参数
- [x] 前端：MedicationGroupManager组件（创建/编辑/删除分组+拖拽分配药品+一键确认）
- [x] 前端：提醒表单添加分组选择器（GroupSelector组件）
- [x] 前端：集成到设置页面（用药提醒和药品库存之间）
- [x] 测试验证（371个测试全部通过）

## 今日用药改造：调用用药提醒+已服用勾选
- [x] 分析现有今日用药区域和提醒确认的代码结构
- [x] 后端：增强todayMeds API返回每个药品的taken状态+reminderHour/reminderMinute/groupId
- [x] 后端：新增unconfirmMedicationTaken API（取消服药确认，从记录中移除药品）
- [x] 前端：今日用药区域改为提醒药品清单+勾选框（CheckCircle2/Circle）
- [x] 前端：勾选调用confirmTaken，取消勾选调用unconfirmTaken
- [x] 前端：handleSave合并已勾选提醒药品+手动额外药品
- [x] 前端：显示已服/总数计数徽章（如 2/3 已服）
- [x] 测试验证（378个测试全部通过）

## 用药提醒支持一天多次服药
- [x] 分析现有数据结构，确定多次服药的改造方案
- [x] 数据库：medication_reminders表新增reminderTimes JSON字段（保留reminderHour/reminderMinute兼容旧数据）
- [x] 后端：更新add/update API支持reminderTimes参数
- [x] 后端：调度器适配多时间点推送（每个时间点独立发送通知）
- [x] 后端：todayMeds API为每个时间点生成独立条目（含timeIndex+taken状态）
- [x] 后端：confirmTaken/unconfirmTaken支持timeIndex参数
- [x] 后端：medMatchHelper支持timeIndex精确匹配（reminderTimeKeys）
- [x] 前端：提醒表单支持添加多个提醒时间（“一天多次”按钮+时间列表）
- [x] 前端：提醒卡片显示多时间点标签（如“3次/天: 08:00, 14:00, 20:00”）
- [x] 前端：今日用药区域按时间点分别显示勾选（含“第N次”标签）
- [x] 前端：打卡日历通过medMatchHelper自动适配多次服药逻辑
- [x] 测试验证（389个测试全部通过）

## 服药间隔智能提醒
- [x] 数据库：medication_reminders表添加intervalHours和lastTakenAt字段
- [x] 后端：confirmMedicationTaken自动更新lastTakenAt时间戳
- [x] 后端：todayMeds API返回intervalHours和lastTakenAt用于前端倒计时
- [x] 后端：add/update接口支持intervalHours参数
- [x] 前端：提醒表单添加“间隔模式”选项（固定时间 vs 间隔模式，支持4/6/8/12/24小时）
- [x] 前端：提醒卡片显示“每Nh”间隔标签
- [x] 前端：今日用药区域显示倒计时（“X小时Y分钟后”/“可以服药了”）
- [x] 测试验证（406个测试全部通过）

## 药品交互检查
- [x] 数据库：新增drug_interactions表（药品A、药品B、严重程度mild/moderate/severe、描述、建议）
- [x] 后端：LLM辅助的药品交互检查API（drugInteractions.analyze，用户药品列表→AI分析交互风险）
- [x] 后端：交互记录CRUD API（list/add/delete）
- [x] 前端：DrugInteractionChecker组件（一键分析+严重程度颜色标记+建议显示）
- [x] 前端：集成到记录页面（打卡日历下方）
- [x] 测试验证（406个测试全部通过）

## Bug: 库存选项预设值无法删除修改
- [x] 排查库存组件中预设值无法删除修改的原因（parseInt()||默认值 导致清空时立即回退到预设值）
- [x] 修复预设值的编辑和删除功能（允许空字符串中间状态+onFocus全选+onBlur回退最小值+提交时Number()转换）

## 用药页面独立为底部导航新tab
- [x] 分析当前底部导航和记录页面中服药打卡+今日用药的代码结构
- [x] 创建独立的MedicationView用药页面组件（包含今日用药+服药打卡日历+药品交互检查）
- [x] 修改底部导航栏添加"用药"tab
- [x] 从记录页面移除今日用药和服药打卡日历相关内容（保留SymptomForm中的今日用药因其与保存记录功能关联）
- [x] 测试验证（406个测试全部通过）

## 移除记录tab中的今日用药区域
- [x] 从SymptomForm中移除今日用药渲染区域（替换为简洁的「额外用药」手动添加区域）
- [x] 清理保存逻辑中对用药数据的依赖（不再合并todayMeds，只保存手动添加的药品）
- [x] 测试验证（406个测试全部通过）

## 彻底删除记录tab中的额外用药区域
- [x] 删除SymptomForm中额外用药的UI、状态和保存逻辑
- [x] 测试验证（406个测试全部通过）

## 用药体验优化三项
- [x] 用药tab添加"一键全部打卡"按钮
- [x] 记录保存后弹出提示引导去用药tab打卡
- [x] 历史记录展示当日服药打卡情况

## 移除用药tab顶部的漏服提醒
- [x] 从MedicationView中移除MissedMedicationAlert组件

## 用药体验优化第二批
- [x] 快捷记录保存后弹出提示引导去用药tab打卡
- [x] 药品列表按时间段分组显示（早/中/晚）
- [x] 服药备注功能（打卡时可选填备注，后端confirmTaken支持note字段）
- [x] 历史记录按服药完成度筛选（新增completionByDates批量接口）

## 用药提醒支持设置用药起始日期
- [x] 数据库：medication_reminders表添加startDate字段
- [x] 后端：add/update接口支持startDate参数
- [x] 后端：打卡日历/依从性统计/todayMeds/timeline/dayDetail/completionByDates/allConfirm等逻辑均排除起始日期之前的数据
- [x] 前端：提醒表单添加起始日期选择器，卡片展示起始日期标签
- [x] 测试验证（406个测试全部通过）

## 历史页面UI优化
- [x] 将导入、JSON导出、CSV导出三个按钮合并为一个"导入/导出"下拉菜单按钮
- [x] 调小视图切换图标（列表/日历/用药）的大小（w-3 h-3 + p-1）

## 历史页面优化第三批
- [x] 历史记录搜索框：支持按备注内容、诱因、药品名搜索
- [x] 下拉菜单添加分隔线：导入和导出之间
- [x] 记录条数文字换行优化：小屏幕下缩短为"X 条"

## 备注功能修复和回显
- [x] 修复备注确认按钮UI被截断的问题（按钮太窄，文字竖排）
- [x] 已服药品显示备注内容（用药tab中，已打卡药品旁显示备注）
- [x] 打卡日历日详情中展示备注
- [x] 历史记录展开详情中展示备注
