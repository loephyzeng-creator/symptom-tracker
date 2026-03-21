/**
 * Export AI Analysis report to PDF using html2canvas + jsPDF
 * Renders the markdown content into a styled HTML container, captures it as an image, and outputs a PDF.
 */
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

/**
 * Simple markdown to HTML converter for the analysis report.
 * Handles headings, bold, lists, paragraphs, and horizontal rules.
 */
function markdownToHtml(md: string): string {
  let html = md
    // Escape HTML entities
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Process line by line
  const lines = html.split("\n");
  let result: string[] = [];
  let inList = false;
  let inParagraph = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headings
    if (line.match(/^### /)) {
      if (inList) { result.push("</ul>"); inList = false; }
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      result.push(`<h3>${line.replace(/^### /, "")}</h3>`);
      continue;
    }
    if (line.match(/^## /)) {
      if (inList) { result.push("</ul>"); inList = false; }
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      result.push(`<h2>${line.replace(/^## /, "")}</h2>`);
      continue;
    }
    if (line.match(/^# /)) {
      if (inList) { result.push("</ul>"); inList = false; }
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      result.push(`<h1>${line.replace(/^# /, "")}</h1>`);
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      if (inList) { result.push("</ul>"); inList = false; }
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      result.push("<hr />");
      continue;
    }

    // List items
    if (line.match(/^[-*] /)) {
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      if (!inList) { result.push("<ul>"); inList = true; }
      result.push(`<li>${line.replace(/^[-*] /, "")}</li>`);
      continue;
    }

    // Numbered list items
    if (line.match(/^\d+\. /)) {
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      if (!inList) { result.push("<ol>"); inList = true; }
      result.push(`<li>${line.replace(/^\d+\. /, "")}</li>`);
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      if (inList) { result.push("</ul>"); inList = false; }
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      continue;
    }

    // Regular text
    if (!inParagraph) {
      result.push("<p>");
      inParagraph = true;
    } else {
      result.push("<br />");
    }
    result.push(line);
  }

  if (inList) result.push("</ul>");
  if (inParagraph) result.push("</p>");

  let output = result.join("\n");

  // Inline formatting
  output = output.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*(.+?)\*/g, "<em>$1</em>");
  output = output.replace(/`(.+?)`/g, '<code>$1</code>');

  return output;
}

export async function exportAnalysisPdf(markdownContent: string): Promise<void> {
  // Create a hidden container for rendering
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "680px";
  container.style.padding = "40px";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#1a1a1a";
  container.style.fontFamily = "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  container.style.fontSize = "13px";
  container.style.lineHeight = "1.8";

  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  const htmlContent = markdownToHtml(markdownContent);

  container.innerHTML = `
    <div style="border-bottom: 2px solid #7c5c3e; padding-bottom: 16px; margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; font-size: 22px; color: #7c5c3e; font-weight: 700;">症状日记 · AI 智能分析报告</h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #888;">生成日期：${dateStr}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 11px; color: #aaa;">Symptom Tracker</p>
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #aaa;">AI Analysis Report</p>
        </div>
      </div>
    </div>
    <style>
      h1 { font-size: 18px; color: #7c5c3e; margin: 20px 0 10px 0; font-weight: 700; }
      h2 { font-size: 16px; color: #7c5c3e; margin: 18px 0 8px 0; font-weight: 600; border-bottom: 1px solid #e8e0d8; padding-bottom: 6px; }
      h3 { font-size: 14px; color: #555; margin: 14px 0 6px 0; font-weight: 600; }
      p { margin: 6px 0; color: #333; }
      ul, ol { margin: 6px 0; padding-left: 20px; }
      li { margin: 3px 0; color: #333; }
      strong { color: #7c5c3e; }
      em { color: #666; font-style: italic; }
      code { background: #f5f0eb; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
      hr { border: none; border-top: 1px solid #e8e0d8; margin: 16px 0; }
    </style>
    <div class="report-content">${htmlContent}</div>
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e8e0d8;">
      <p style="font-size: 11px; color: #aaa; text-align: center;">
        ⚠️ AI 分析仅供参考，不能替代专业医疗建议。如有健康疑虑，请咨询医生。
      </p>
    </div>
  `;

  document.body.appendChild(container);

  try {
    // Wait for fonts to load
    await document.fonts.ready;
    await new Promise((resolve) => setTimeout(resolve, 200));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // A4 dimensions in mm
    const pdfWidth = 210;
    const pdfHeight = 297;
    const margin = 10;
    const contentWidth = pdfWidth - margin * 2;
    const contentHeight = (imgHeight * contentWidth) / imgWidth;

    const pdf = new jsPDF("p", "mm", "a4");

    // If content fits in one page
    if (contentHeight <= pdfHeight - margin * 2) {
      pdf.addImage(imgData, "JPEG", margin, margin, contentWidth, contentHeight);
    } else {
      // Multi-page: slice the image
      const pageContentHeight = pdfHeight - margin * 2;
      const totalPages = Math.ceil(contentHeight / pageContentHeight);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        // Calculate the source rectangle for this page
        const srcY = (page * pageContentHeight * imgWidth) / contentWidth;
        const srcHeight = Math.min(
          (pageContentHeight * imgWidth) / contentWidth,
          imgHeight - srcY
        );

        // Create a canvas for this page slice
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = imgWidth;
        pageCanvas.height = srcHeight;
        const ctx = pageCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, srcY, imgWidth, srcHeight, 0, 0, imgWidth, srcHeight);

        const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.95);
        const drawHeight = (srcHeight * contentWidth) / imgWidth;
        pdf.addImage(pageImgData, "JPEG", margin, margin, contentWidth, drawHeight);
      }
    }

    pdf.save(`AI分析报告_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
