/**
 * Urinary symptom-medication correlation report generator.
 * Generates an HTML string suitable for printing to PDF via the browser.
 * Designed for doctor visits: clear, professional, data-driven.
 */

interface MedicationItem {
  name: string;
  dosage: string;
}

interface EntryRow {
  date: string;
  dizziness: number;
  headache: number;
  sleepQuality: number;
  anxiety: number;
  fatigue: number;
  photosensitivity: number;
  motionSickness: number;
  palpitations: number;
  mood: number;
  medications: MedicationItem[] | string | null;
  triggers: string[] | null;
  severeHeadache?: number;
  painkillerTaken?: number;
  notes: string | null;
}

interface MedicationReminderInfo {
  medicationName: string;
  dosage: string;
  startDate?: string | null;
  endDate?: string | null;
  reminderTimes?: Array<{ hour: number; minute: number }> | null;
  repeatDays?: number[] | null;
  enabled: number;
}

const URINARY_TRIGGERS = ["排尿困难", "尿等待", "夜尿增多", "排尿不尽", "尿频", "尿急"];

// Known drug categories with urinary side effects
const DRUG_URINARY_RISK: Record<string, { risk: string; mechanism: string; color: string }> = {
  "度洛西汀": { risk: "高", mechanism: "SNRI类，通过去甲肾上腺素增加尿道闭合压，可致尿潴留", color: "#dc3545" },
  "欣百达": { risk: "高", mechanism: "度洛西汀品牌名，SNRI类，增加尿道闭合压", color: "#dc3545" },
  "氟哌噻吨美利曲辛": { risk: "中", mechanism: "美利曲辛成分具有抗胆碱能活性，可抑制膀胱逼尿肌收缩", color: "#e67e22" },
  "黛力新": { risk: "中", mechanism: "美利曲辛成分具有抗胆碱能活性，可抑制膀胱逼尿肌收缩", color: "#e67e22" },
  "艾司西酞普兰": { risk: "低", mechanism: "SSRI类，低剂量时泌尿影响较小，但可能增强其他药物的泌尿副作用", color: "#7a9a6e" },
  "草酸艾司西酞普兰": { risk: "低", mechanism: "SSRI类，低剂量时泌尿影响较小", color: "#7a9a6e" },
  "来士普": { risk: "低", mechanism: "艾司西酞普兰品牌名，SSRI类", color: "#7a9a6e" },
  "乙哌立松": { risk: "极低", mechanism: "肌松弛剂，对泌尿系统影响极小", color: "#7a9a6e" },
  "盐酸乙哌立松": { risk: "极低", mechanism: "肌松弛剂，对泌尿系统影响极小", color: "#7a9a6e" },
  "二氢麦角碱": { risk: "极低", mechanism: "麦角生物碱类，对泌尿系统影响极小", color: "#7a9a6e" },
  "甲磺酸二氢麦角碱": { risk: "极低", mechanism: "麦角生物碱类，对泌尿系统影响极小", color: "#7a9a6e" },
};

function normalizeMedications(meds: MedicationItem[] | string | null | undefined): MedicationItem[] {
  if (!meds) return [];
  if (Array.isArray(meds)) return meds;
  if (typeof meds === "string") {
    if (!meds.trim()) return [];
    return meds.split(/[,，\n]/).filter(Boolean).map(s => ({ name: s.trim(), dosage: "" }));
  }
  return [];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateCN(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function matchDrugRisk(medName: string): { risk: string; mechanism: string; color: string } | null {
  for (const [keyword, info] of Object.entries(DRUG_URINARY_RISK)) {
    if (medName.includes(keyword)) return info;
  }
  return null;
}

export function generateUrinaryReportHTML(
  entries: EntryRow[],
  startDate: string,
  endDate: string,
  userName: string,
  medicationReminders?: MedicationReminderInfo[] | null
): string {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  // Separate entries with/without urinary symptoms
  const withUrinary: (EntryRow & { urinarySymptoms: string[] })[] = [];
  const withoutUrinary: EntryRow[] = [];

  for (const e of sorted) {
    const triggers = Array.isArray(e.triggers) ? e.triggers : [];
    const urinarySymptoms = triggers.filter(t => URINARY_TRIGGERS.includes(t));
    if (urinarySymptoms.length > 0) {
      withUrinary.push({ ...e, urinarySymptoms });
    } else {
      withoutUrinary.push(e);
    }
  }

  // Urinary symptom frequency
  const urinaryFreq: Record<string, number> = {};
  for (const e of withUrinary) {
    for (const s of e.urinarySymptoms) {
      urinaryFreq[s] = (urinaryFreq[s] || 0) + 1;
    }
  }
  const urinaryFreqSorted = Object.entries(urinaryFreq).sort((a, b) => b[1] - a[1]);

  // Medication comparison: urinary days vs non-urinary days
  const medOnUrinary: Record<string, number> = {};
  const medOnNonUrinary: Record<string, number> = {};
  for (const e of withUrinary) {
    for (const m of normalizeMedications(e.medications)) {
      if (m.name.trim()) {
        const key = m.dosage ? `${m.name} ${m.dosage}` : m.name;
        medOnUrinary[key] = (medOnUrinary[key] || 0) + 1;
      }
    }
  }
  for (const e of withoutUrinary) {
    for (const m of normalizeMedications(e.medications)) {
      if (m.name.trim()) {
        const key = m.dosage ? `${m.name} ${m.dosage}` : m.name;
        medOnNonUrinary[key] = (medOnNonUrinary[key] || 0) + 1;
      }
    }
  }
  const allMedKeys = Array.from(new Set([...Object.keys(medOnUrinary), ...Object.keys(medOnNonUrinary)]));

  // Weekly trend
  const weeklyData: Record<string, { total: number; urinary: number }> = {};
  for (const e of sorted) {
    const d = new Date(e.date + "T00:00:00");
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(new Date(d).setDate(diff));
    const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    if (!weeklyData[weekKey]) weeklyData[weekKey] = { total: 0, urinary: 0 };
    weeklyData[weekKey].total++;
    const triggers = Array.isArray(e.triggers) ? e.triggers : [];
    if (triggers.some(t => URINARY_TRIGGERS.includes(t))) {
      weeklyData[weekKey].urinary++;
    }
  }
  const weeklyEntries = Object.entries(weeklyData).sort((a, b) => a[0].localeCompare(b[0]));

  // Current medication risk assessment
  const activeReminders = medicationReminders?.filter(r => r.enabled === 1) || [];
  const medRiskAssessment = activeReminders.map(r => {
    const risk = matchDrugRisk(r.medicationName);
    return {
      name: r.medicationName,
      dosage: r.dosage,
      risk: risk?.risk || "未知",
      mechanism: risk?.mechanism || "暂无该药品的泌尿系统影响数据",
      color: risk?.color || "#8a8580",
    };
  }).sort((a, b) => {
    const order: Record<string, number> = { "高": 0, "中": 1, "低": 2, "极低": 3, "未知": 4 };
    return (order[a.risk] ?? 5) - (order[b.risk] ?? 5);
  });

  const generatedAt = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>泌尿症状-用药关联报告</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@300;400;500;600&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  @page {
    size: A4;
    margin: 20mm 15mm;
  }
  
  body {
    font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 11px;
    line-height: 1.6;
    color: #2d2a26;
    background: #fff;
    padding: 0;
  }
  
  .report-header {
    text-align: center;
    border-bottom: 2px solid #2563eb;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  
  .report-header h1 {
    font-family: 'Noto Serif SC', serif;
    font-size: 22px;
    font-weight: 700;
    color: #2563eb;
    margin-bottom: 4px;
  }
  
  .report-header .subtitle {
    font-size: 12px;
    color: #8a8580;
  }
  
  .meta-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #6b6560;
    margin-bottom: 20px;
    padding: 8px 12px;
    background: #f0f4ff;
    border-radius: 6px;
  }
  
  .section {
    margin-bottom: 20px;
    page-break-inside: avoid;
  }
  
  .section h2 {
    font-family: 'Noto Serif SC', serif;
    font-size: 14px;
    font-weight: 600;
    color: #2563eb;
    border-left: 3px solid #2563eb;
    padding-left: 8px;
    margin-bottom: 10px;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  
  th {
    background: #f0f4ff;
    font-weight: 600;
    text-align: center;
    padding: 6px 4px;
    border: 1px solid #d0d8e8;
    color: #374151;
  }
  
  td {
    text-align: center;
    padding: 5px 4px;
    border: 1px solid #d0d8e8;
  }
  
  .risk-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
  }
  
  .summary-box {
    padding: 12px 16px;
    background: #f0f4ff;
    border-radius: 8px;
    margin-bottom: 12px;
    display: flex;
    gap: 24px;
    align-items: center;
  }
  
  .summary-number {
    text-align: center;
  }
  
  .summary-number .big {
    font-size: 28px;
    font-weight: 700;
    color: #2563eb;
  }
  
  .summary-number .label {
    font-size: 10px;
    color: #8a8580;
  }
  
  .bar-container {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
  }
  
  .bar-label {
    width: 80px;
    text-align: right;
    padding-right: 8px;
    font-size: 11px;
    color: #374151;
  }
  
  .bar-bg {
    flex: 1;
    height: 18px;
    background: #e5e7eb;
    border-radius: 9px;
    overflow: hidden;
  }
  
  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    border-radius: 9px;
    min-width: 2px;
  }
  
  .bar-value {
    width: 60px;
    text-align: left;
    padding-left: 8px;
    font-size: 10px;
    color: #6b7280;
  }
  
  .warning-box {
    padding: 10px 14px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    margin-bottom: 12px;
    font-size: 11px;
    color: #991b1b;
  }
  
  .info-box {
    padding: 10px 14px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    margin-bottom: 12px;
    font-size: 11px;
    color: #1e40af;
  }
  
  .mechanism-text {
    font-size: 10px;
    color: #6b7280;
    line-height: 1.5;
    padding: 4px 0;
  }
  
  .footer {
    margin-top: 30px;
    text-align: center;
    font-size: 9px;
    color: #b0aaa5;
    border-top: 1px solid #d0d8e8;
    padding-top: 10px;
  }
  
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: #f0f4ff;
    border-bottom: 1px solid #d0d8e8;
    margin-bottom: 16px;
  }
  
  .toolbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: 1px solid #93c5fd;
    border-radius: 8px;
    background: #fff;
    color: #374151;
    font-size: 12px;
    font-family: 'Noto Sans SC', sans-serif;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .toolbar-btn:hover {
    background: #eff6ff;
    color: #2563eb;
    border-color: #2563eb;
  }
  
  .toolbar-btn svg {
    width: 14px;
    height: 14px;
  }
  
  .toolbar-hint {
    font-size: 11px;
    color: #6b7280;
  }

  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<div class="toolbar no-print">
  <button class="toolbar-btn" onclick="window.close(); if(!window.closed) history.back();">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
    返回
  </button>
  <span class="toolbar-hint">建议打印后带去复诊，供医生参考</span>
  <button class="toolbar-btn" onclick="window.print()">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
    打印 / 保存 PDF
  </button>
</div>

<div class="report-header">
  <h1>泌尿症状-用药关联报告</h1>
  <div class="subtitle">Urinary Symptom – Medication Correlation Report</div>
</div>

<div class="meta-row">
  <span>记录人：${escapeHtml(userName)}</span>
  <span>报告周期：${formatDateCN(startDate)} — ${formatDateCN(endDate)}</span>
  <span>共 ${sorted.length} 条记录</span>
  <span>生成时间：${generatedAt}</span>
</div>

<!-- 1. 概览 -->
<div class="section">
  <h2>数据概览</h2>
  <div class="summary-box">
    <div class="summary-number">
      <div class="big">${withUrinary.length}</div>
      <div class="label">泌尿症状天数</div>
    </div>
    <div class="summary-number">
      <div class="big">${sorted.length}</div>
      <div class="label">总记录天数</div>
    </div>
    <div class="summary-number">
      <div class="big">${sorted.length > 0 ? Math.round((withUrinary.length / sorted.length) * 100) : 0}%</div>
      <div class="label">出现率</div>
    </div>
    <div class="summary-number">
      <div class="big">${activeReminders.length}</div>
      <div class="label">当前用药种类</div>
    </div>
  </div>
  ${withUrinary.length === 0 ? `
  <div class="info-box">
    在报告周期内未记录到泌尿系统症状。如您有相关症状但未记录，建议在每日记录中勾选对应的诱因标签（排尿困难、尿等待、夜尿增多等）。
  </div>` : ""}
</div>

${urinaryFreqSorted.length > 0 ? `
<!-- 2. 泌尿症状频率 -->
<div class="section">
  <h2>泌尿症状频率分布</h2>
  ${urinaryFreqSorted.map(([name, count]) => {
    const pct = sorted.length > 0 ? Math.round((count / sorted.length) * 100) : 0;
    return `
  <div class="bar-container">
    <div class="bar-label">${escapeHtml(name)}</div>
    <div class="bar-bg">
      <div class="bar-fill" style="width:${Math.max(pct, 2)}%"></div>
    </div>
    <div class="bar-value">${count}天 (${pct}%)</div>
  </div>`;
  }).join("")}
</div>
` : ""}

<!-- 3. 当前用药泌尿风险评估 -->
<div class="section">
  <h2>当前用药泌尿系统风险评估</h2>
  ${medRiskAssessment.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th style="text-align:left">药品名称</th>
        <th style="text-align:left">剂量</th>
        <th>泌尿风险</th>
        <th style="text-align:left">作用机制</th>
      </tr>
    </thead>
    <tbody>
      ${medRiskAssessment.map(m => `
      <tr>
        <td style="text-align:left;font-weight:500">${escapeHtml(m.name)}</td>
        <td style="text-align:left">${escapeHtml(m.dosage)}</td>
        <td><span class="risk-badge" style="background:${m.color}">${m.risk}</span></td>
        <td style="text-align:left;font-size:9px;color:#6b7280">${escapeHtml(m.mechanism)}</td>
      </tr>`).join("")}
    </tbody>
  </table>
  ${medRiskAssessment.filter(m => m.risk === "高" || m.risk === "中").length >= 2 ? `
  <div class="warning-box" style="margin-top:10px">
    <strong>多药联用叠加风险警告：</strong>当前有 ${medRiskAssessment.filter(m => m.risk === "高" || m.risk === "中").length} 种药物具有中-高泌尿风险。
    多种影响泌尿系统的药物联用可能产生叠加效应（如增加尿道阻力 + 抑制膀胱收缩），建议复诊时重点告知医生。
  </div>` : ""}
  ` : `<p style="color:#8a8580">暂无用药提醒数据。</p>`}
</div>

${withUrinary.length > 0 && allMedKeys.length > 0 ? `
<!-- 4. 用药对比分析 -->
<div class="section">
  <h2>泌尿症状日 vs 无症状日用药对比</h2>
  <p style="font-size:10px;color:#6b7280;margin-bottom:8px">对比出现泌尿症状的天数与未出现的天数中，各药物的使用频率</p>
  <table>
    <thead>
      <tr>
        <th style="text-align:left">药品</th>
        <th>泌尿症状日使用率</th>
        <th>无症状日使用率</th>
        <th>差异</th>
      </tr>
    </thead>
    <tbody>
      ${allMedKeys.map(med => {
        const onU = medOnUrinary[med] || 0;
        const onN = medOnNonUrinary[med] || 0;
        const rateU = withUrinary.length > 0 ? Math.round((onU / withUrinary.length) * 100) : 0;
        const rateN = withoutUrinary.length > 0 ? Math.round((onN / withoutUrinary.length) * 100) : 0;
        const diff = rateU - rateN;
        const diffColor = diff > 10 ? "#dc3545" : diff < -10 ? "#7a9a6e" : "#6b7280";
        return `
      <tr>
        <td style="text-align:left;font-weight:500">${escapeHtml(med)}</td>
        <td>${rateU}% (${onU}/${withUrinary.length}天)</td>
        <td>${rateN}% (${onN}/${withoutUrinary.length}天)</td>
        <td style="color:${diffColor};font-weight:600">${diff > 0 ? "+" : ""}${diff}%</td>
      </tr>`;
      }).join("")}
    </tbody>
  </table>
  <p style="font-size:9px;color:#8a8580;margin-top:6px">注：差异为正值表示该药物在泌尿症状日使用率更高，可能与症状相关；但相关性不等于因果关系。</p>
</div>
` : ""}

${weeklyEntries.length > 1 ? `
<!-- 5. 每周趋势 -->
<div class="section">
  <h2>泌尿症状每周趋势</h2>
  <table>
    <thead>
      <tr>
        <th>周起始日</th>
        <th>记录天数</th>
        <th>泌尿症状天数</th>
        <th>出现率</th>
        <th>趋势</th>
      </tr>
    </thead>
    <tbody>
      ${weeklyEntries.map(([week, data], idx) => {
        const pct = data.total > 0 ? Math.round((data.urinary / data.total) * 100) : 0;
        const prevPct = idx > 0 ? Math.round((weeklyEntries[idx - 1][1].urinary / weeklyEntries[idx - 1][1].total) * 100) : pct;
        const trend = idx === 0 ? "—" : pct > prevPct ? "↑ 加重" : pct < prevPct ? "↓ 改善" : "→ 持平";
        const trendColor = trend.includes("加重") ? "#dc3545" : trend.includes("改善") ? "#7a9a6e" : "#6b7280";
        return `
      <tr>
        <td>${week}</td>
        <td>${data.total}</td>
        <td>${data.urinary}</td>
        <td>${pct}%</td>
        <td style="color:${trendColor}">${trend}</td>
      </tr>`;
      }).join("")}
    </tbody>
  </table>
</div>
` : ""}

${withUrinary.length > 0 ? `
<!-- 6. 泌尿症状详细记录 -->
<div class="section">
  <h2>泌尿症状出现日明细</h2>
  <table>
    <thead>
      <tr>
        <th style="width:70px">日期</th>
        <th>泌尿症状</th>
        <th>当日用药</th>
        <th>其他诱因</th>
        <th>备注</th>
      </tr>
    </thead>
    <tbody>
      ${withUrinary.map(e => {
        const otherTriggers = (Array.isArray(e.triggers) ? e.triggers : []).filter(t => !URINARY_TRIGGERS.includes(t));
        const meds = normalizeMedications(e.medications);
        const medStr = meds.length > 0 ? meds.map(m => m.dosage ? `${m.name} ${m.dosage}` : m.name).join("、") : "—";
        return `
      <tr>
        <td style="text-align:left;font-weight:500">${e.date.slice(5)}</td>
        <td style="color:#2563eb;font-weight:500">${e.urinarySymptoms.join("、")}</td>
        <td style="font-size:9px;text-align:left">${escapeHtml(medStr)}</td>
        <td style="font-size:9px">${otherTriggers.length > 0 ? escapeHtml(otherTriggers.join("、")) : "—"}</td>
        <td style="font-size:9px;text-align:left">${e.notes ? escapeHtml(e.notes) : "—"}</td>
      </tr>`;
      }).join("")}
    </tbody>
  </table>
</div>
` : ""}

<!-- 7. 复诊建议 -->
<div class="section">
  <h2>复诊建议要点</h2>
  <div class="info-box">
    <p style="margin-bottom:6px"><strong>建议复诊时向医生说明以下信息：</strong></p>
    <ol style="padding-left:20px;line-height:2">
      <li>报告周期内泌尿症状出现 <strong>${withUrinary.length} 天</strong>（共 ${sorted.length} 天），出现率 <strong>${sorted.length > 0 ? Math.round((withUrinary.length / sorted.length) * 100) : 0}%</strong></li>
      ${medRiskAssessment.filter(m => m.risk === "高").length > 0 ? `<li>当前服用的 <strong>${medRiskAssessment.filter(m => m.risk === "高").map(m => m.name).join("、")}</strong> 属于泌尿系统高风险药物</li>` : ""}
      ${medRiskAssessment.filter(m => m.risk === "中").length > 0 ? `<li><strong>${medRiskAssessment.filter(m => m.risk === "中").map(m => m.name).join("、")}</strong> 属于中风险药物</li>` : ""}
      ${medRiskAssessment.filter(m => m.risk === "高" || m.risk === "中").length >= 2 ? `<li>多种影响泌尿系统的药物联用，可能存在叠加效应</li>` : ""}
      <li>请医生评估是否需要调整用药方案或加用缓解泌尿症状的药物（如α受体阻滞剂）</li>
      <li>如有前列腺相关病史，请一并告知</li>
    </ol>
  </div>
</div>

<div class="footer">
  本报告由「症状日记」自动生成，仅供就诊参考，不构成医学诊断或治疗建议。药物调整请务必咨询专业医生。
</div>

</body>
</html>`;
}
