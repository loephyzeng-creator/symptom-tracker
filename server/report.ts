/**
 * Report generation helpers.
 * Generates an HTML string suitable for printing to PDF via the browser.
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
  notes: string | null;
}

function normalizeMedications(meds: MedicationItem[] | string | null | undefined): MedicationItem[] {
  if (!meds) return [];
  if (Array.isArray(meds)) return meds;
  if (typeof meds === "string") {
    if (!meds.trim()) return [];
    return meds.split(/[,，\n]/).filter(Boolean).map(s => ({ name: s.trim(), dosage: "" }));
  }
  return [];
}

function formatMeds(meds: MedicationItem[] | string | null | undefined): string {
  const items = normalizeMedications(meds);
  if (items.length === 0) return "—";
  return items.map(m => m.dosage ? `${m.name} ${m.dosage}` : m.name).join("、");
}

const SYMPTOM_LABELS: Record<string, string> = {
  dizziness: "头晕脑胀",
  headache: "头痛程度",
  sleepQuality: "睡眠质量",
  anxiety: "焦虑程度",
  fatigue: "疲劳程度",
  photosensitivity: "畏光程度",
  motionSickness: "运动敏感",
  palpitations: "心慌程度",
  mood: "整体心情",
};

const SYMPTOM_KEYS = Object.keys(SYMPTOM_LABELS);

function computeAvg(entries: EntryRow[], key: string): string {
  if (entries.length === 0) return "—";
  const sum = entries.reduce((acc, e) => acc + ((e as unknown as Record<string, number>)[key] ?? 0), 0);
  return (sum / entries.length).toFixed(1);
}

function computeTriggerFrequency(entries: EntryRow[]): { name: string; count: number; pct: string }[] {
  const freq: Record<string, number> = {};
  for (const e of entries) {
    if (e.triggers && Array.isArray(e.triggers)) {
      for (const t of e.triggers) {
        freq[t] = (freq[t] || 0) + 1;
      }
    }
  }
  const total = entries.length;
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({
      name,
      count,
      pct: total > 0 ? ((count / total) * 100).toFixed(0) + "%" : "0%",
    }));
}

function formatDateCN(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function generateReportHTML(
  entries: EntryRow[],
  startDate: string,
  endDate: string,
  userName: string
): string {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const triggerFreq = computeTriggerFrequency(sorted);

  // Medication summary
  const medFreq: Record<string, number> = {};
  for (const e of sorted) {
    const items = normalizeMedications(e.medications);
    for (const m of items) {
      const key = m.dosage ? `${m.name} ${m.dosage}` : m.name;
      medFreq[key] = (medFreq[key] || 0) + 1;
    }
  }
  const medList = Object.entries(medFreq).sort((a, b) => b[1] - a[1]);

  const generatedAt = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>症状日记 · 就诊报告</title>
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
    border-bottom: 2px solid #c4704b;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  
  .report-header h1 {
    font-family: 'Noto Serif SC', serif;
    font-size: 22px;
    font-weight: 700;
    color: #c4704b;
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
    background: #faf8f5;
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
    color: #c4704b;
    border-left: 3px solid #c4704b;
    padding-left: 8px;
    margin-bottom: 10px;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  
  th {
    background: #faf8f5;
    font-weight: 600;
    text-align: center;
    padding: 6px 4px;
    border: 1px solid #e8e2dc;
    color: #5a5550;
  }
  
  td {
    text-align: center;
    padding: 5px 4px;
    border: 1px solid #e8e2dc;
  }
  
  td.date-cell {
    text-align: left;
    white-space: nowrap;
    font-weight: 500;
  }
  
  .score-high { color: #dc3545; font-weight: 600; }
  .score-mid { color: #c4704b; }
  .score-low { color: #7a9a6e; }
  
  .avg-row td {
    background: #faf8f5;
    font-weight: 600;
    color: #c4704b;
  }
  
  .trigger-bar {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
  }
  
  .trigger-name {
    width: 80px;
    text-align: right;
    padding-right: 8px;
    font-size: 11px;
    color: #5a5550;
  }
  
  .trigger-bar-bg {
    flex: 1;
    height: 18px;
    background: #f0ebe5;
    border-radius: 9px;
    overflow: hidden;
    position: relative;
  }
  
  .trigger-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #c4704b, #d4956e);
    border-radius: 9px;
    min-width: 2px;
  }
  
  .trigger-bar-label {
    width: 60px;
    text-align: left;
    padding-left: 8px;
    font-size: 10px;
    color: #8a8580;
  }
  
  .med-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  
  .med-tag {
    display: inline-block;
    padding: 3px 10px;
    background: #eef2ea;
    color: #5a7a4e;
    border-radius: 12px;
    font-size: 11px;
  }
  
  .med-count {
    font-size: 9px;
    color: #8a8580;
    margin-left: 2px;
  }
  
  .notes-section {
    font-size: 10px;
    color: #6b6560;
  }
  
  .notes-section .note-item {
    margin-bottom: 4px;
    padding: 4px 8px;
    background: #faf8f5;
    border-radius: 4px;
  }
  
  .note-date {
    font-weight: 600;
    color: #c4704b;
    margin-right: 6px;
  }
  
  .footer {
    margin-top: 30px;
    text-align: center;
    font-size: 9px;
    color: #b0aaa5;
    border-top: 1px solid #e8e2dc;
    padding-top: 10px;
  }
  
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>

<div class="report-header">
  <h1>症状日记 · 就诊报告</h1>
  <div class="subtitle">Symptom Diary Report</div>
</div>

<div class="meta-row">
  <span>记录人：${escapeHtml(userName)}</span>
  <span>报告周期：${formatDateCN(startDate)} — ${formatDateCN(endDate)}</span>
  <span>共 ${sorted.length} 条记录</span>
  <span>生成时间：${generatedAt}</span>
</div>

<!-- 1. 症状评分汇总 -->
<div class="section">
  <h2>症状评分汇总</h2>
  <table>
    <thead>
      <tr>
        <th style="width:70px">日期</th>
        ${SYMPTOM_KEYS.map(k => `<th>${SYMPTOM_LABELS[k]}</th>`).join("")}
        <th>剧烈头痛</th>
        <th>用药</th>
      </tr>
    </thead>
    <tbody>
      ${sorted.map(e => `
      <tr>
        <td class="date-cell">${e.date.slice(5)}</td>
        ${SYMPTOM_KEYS.map(k => {
          const v = (e as unknown as Record<string, number>)[k] ?? 0;
          const cls = v >= 7 ? "score-high" : v >= 4 ? "score-mid" : "score-low";
          return `<td class="${cls}">${v}</td>`;
        }).join("")}
        <td style="text-align:center">${e.severeHeadache === 1 ? '<span style="color:#d32f2f">⚠️ 是</span>' : '-'}</td>
        <td style="font-size:9px;text-align:left">${formatMeds(e.medications)}</td>
      </tr>`).join("")}
      <tr class="avg-row">
        <td>平均</td>
        ${SYMPTOM_KEYS.map(k => `<td>${computeAvg(sorted, k)}</td>`).join("")}
        <td></td>
        <td></td>
      </tr>
    </tbody>
  </table>
</div>

${triggerFreq.length > 0 ? `
<div class="section">
  <h2>诱因频率统计（Top ${triggerFreq.length}）</h2>
  ${triggerFreq.map(t => `
  <div class="trigger-bar">
    <div class="trigger-name">${escapeHtml(t.name)}</div>
    <div class="trigger-bar-bg">
      <div class="trigger-bar-fill" style="width:${t.pct}"></div>
    </div>
    <div class="trigger-bar-label">${t.count}次 (${t.pct})</div>
  </div>`).join("")}
</div>
` : ""}

${medList.length > 0 ? `
<div class="section">
  <h2>用药记录汇总</h2>
  <div class="med-list">
    ${medList.map(([name, count]) => `
    <span class="med-tag">${escapeHtml(name)} <span class="med-count">×${count}</span></span>`).join("")}
  </div>
</div>
` : ""}

${sorted.filter(e => e.notes).length > 0 ? `
<div class="section">
  <h2>备注摘要</h2>
  <div class="notes-section">
    ${sorted.filter(e => e.notes).map(e => `
    <div class="note-item">
      <span class="note-date">${e.date.slice(5)}</span>${escapeHtml(e.notes!)}
    </div>`).join("")}
  </div>
</div>
` : ""}

<div class="footer">
  本报告由「症状日记」自动生成，仅供就诊参考。如有疑问请咨询专业医生。
</div>

</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/=/g, "&#61;");
}
