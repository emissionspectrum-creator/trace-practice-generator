const STORAGE_KEY = "trace-practice-generator-settings-v1";

const DEFAULT_SETTINGS = {
  text: "",
  bigCellSizeCm: 3.0,
  pagePaddingMm: 12,
  traceOpacity: 0.18,
  showGridGuides: true
};

const elements = {
  inputText: document.getElementById("inputText"),
  bigCellSizeCm: document.getElementById("bigCellSizeCm"),
  pagePaddingMm: document.getElementById("pagePaddingMm"),
  traceOpacity: document.getElementById("traceOpacity"),
  traceOpacityValue: document.getElementById("traceOpacityValue"),
  showGridGuides: document.getElementById("showGridGuides"),
  generateBtn: document.getElementById("generateBtn"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),
  resetBtn: document.getElementById("resetBtn"),
  statusMessage: document.getElementById("statusMessage"),
  pagePreview: document.getElementById("pagePreview"),
  pageContent: document.getElementById("pageContent"),
  moduleTemplate: document.getElementById("characterModuleTemplate")
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getSettingsFromUI() {
  return {
    text: elements.inputText.value || "",
    bigCellSizeCm: clamp(safeNumber(elements.bigCellSizeCm.value, DEFAULT_SETTINGS.bigCellSizeCm), 1, 8),
    pagePaddingMm: clamp(safeNumber(elements.pagePaddingMm.value, DEFAULT_SETTINGS.pagePaddingMm), 5, 30),
    traceOpacity: clamp(safeNumber(elements.traceOpacity.value, DEFAULT_SETTINGS.traceOpacity), 0.05, 0.5),
    showGridGuides: elements.showGridGuides.checked
  };
}

function applySettingsToUI(settings) {
  elements.inputText.value = settings.text;
  elements.bigCellSizeCm.value = Number(settings.bigCellSizeCm).toFixed(1);
  elements.pagePaddingMm.value = String(settings.pagePaddingMm);
  elements.traceOpacity.value = Number(settings.traceOpacity).toFixed(2);
  elements.traceOpacityValue.textContent = Number(settings.traceOpacity).toFixed(2);
  elements.showGridGuides.checked = Boolean(settings.showGridGuides);
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    return {
      text: typeof parsed.text === "string" ? parsed.text : DEFAULT_SETTINGS.text,
      bigCellSizeCm: clamp(safeNumber(parsed.bigCellSizeCm, DEFAULT_SETTINGS.bigCellSizeCm), 1, 8),
      pagePaddingMm: clamp(safeNumber(parsed.pagePaddingMm, DEFAULT_SETTINGS.pagePaddingMm), 5, 30),
      traceOpacity: clamp(safeNumber(parsed.traceOpacity, DEFAULT_SETTINGS.traceOpacity), 0.05, 0.5),
      showGridGuides: typeof parsed.showGridGuides === "boolean" ? parsed.showGridGuides : DEFAULT_SETTINGS.showGridGuides
    };
  } catch (error) {
    console.warn("讀取設定失敗，將使用預設值。", error);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn("儲存設定失敗。", error);
  }
}

function updateCssVariables(settings) {
  const root = document.documentElement;
  root.style.setProperty("--large-cell-cm", String(settings.bigCellSizeCm));
  root.style.setProperty("--page-padding-mm", String(settings.pagePaddingMm));
  root.style.setProperty("--trace-opacity", Number(settings.traceOpacity).toFixed(2));
}

function setStatus(message) {
  elements.statusMessage.textContent = message;
}

function isLatinCharacter(char) {
  return /^[A-Za-z]$/.test(char);
}

function isWhitespaceCharacter(char) {
  return char === " " || char === "\t";
}

function createPlaceholder() {
  const placeholder = document.createElement("div");
  placeholder.className = "page-placeholder";
  placeholder.textContent = "請在左側輸入文字，右側會即時產生描紅練字頁預覽。";
  return placeholder;
}

function applyCharacterFont(traceNode, char) {
  const largeCellSizeCm = clamp(safeNumber(elements.bigCellSizeCm.value, DEFAULT_SETTINGS.bigCellSizeCm), 1, 8);
  const fontSizeMm = largeCellSizeCm * 10 * 0.72;

  traceNode.textContent = char;
  traceNode.style.fontSize = `${fontSizeMm}mm`;

  if (isLatinCharacter(char)) {
    traceNode.classList.add("font-latin");
    traceNode.classList.remove("font-cjk");
  } else {
    traceNode.classList.add("font-cjk");
    traceNode.classList.remove("font-latin");
  }

  if (isWhitespaceCharacter(char)) {
    traceNode.classList.add("is-space");
  } else {
    traceNode.classList.remove("is-space");
  }
}

function createModuleForCharacter(char, showGridGuides) {
  const fragment = elements.moduleTemplate.content.cloneNode(true);
  const moduleElement = fragment.querySelector(".character-module");
  const cells = fragment.querySelectorAll(".practice-cell");
  const traceNode = fragment.querySelector(".trace-char");

  cells.forEach((cell) => {
    cell.classList.toggle("guide-hidden", !showGridGuides);
  });

  applyCharacterFont(traceNode, char);

  return moduleElement;
}

function createLineBreakSpacer() {
  const spacer = document.createElement("div");
  spacer.className = "module-space";
  spacer.setAttribute("aria-hidden", "true");
  return spacer;
}

function renderPreview() {
  const settings = getSettingsFromUI();
  saveSettings(settings);
  updateCssVariables(settings);

  elements.pageContent.innerHTML = "";

  const characters = Array.from(settings.text || "");
  if (characters.length === 0) {
    elements.pageContent.appendChild(createPlaceholder());
    setStatus("尚未輸入文字。請在左側輸入內容。\n設定會自動儲存於本機瀏覽器。");
    return;
  }

  let visibleCount = 0;

  characters.forEach((char) => {
    if (char === "\r") {
      return;
    }

    if (char === "\n") {
      elements.pageContent.appendChild(createLineBreakSpacer());
      return;
    }

    const moduleElement = createModuleForCharacter(char, settings.showGridGuides);
    elements.pageContent.appendChild(moduleElement);
    visibleCount += 1;
  });

  setStatus(`已產生 ${visibleCount} 個字元模組。\n目前大格大小：${settings.bigCellSizeCm.toFixed(1)} cm。`);
}

async function waitForFontsReady() {
  if (document.fonts && typeof document.fonts.ready === "object") {
    try {
      await document.fonts.ready;
    } catch (error) {
      console.warn("字型等待失敗，將繼續匯出。", error);
    }
  }
}

async function exportPdf() {
  const button = elements.exportPdfBtn;
  button.disabled = true;
  document.body.classList.add("is-exporting");
  setStatus("正在匯出 PDF，請稍候...");

  try {
    if (typeof window.html2canvas !== "function") {
      throw new Error("html2canvas 尚未載入。");
    }
    if (!window.jspdf || typeof window.jspdf.jsPDF !== "function") {
      throw new Error("jsPDF 尚未載入。");
    }

    await waitForFontsReady();

    const canvas = await window.html2canvas(elements.pagePreview, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff"
    });

    const imageData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= pageHeight) {
      pdf.addImage(imageData, "PNG", 0, 0, imgWidth, imgHeight, undefined, "FAST");
    } else {
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imageData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imageData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
        heightLeft -= pageHeight;
      }
    }

    pdf.save("trace-practice-sheet.pdf");
    setStatus("PDF 匯出完成。檔名：trace-practice-sheet.pdf");
  } catch (error) {
    console.error(error);
    setStatus(`PDF 匯出失敗：${error.message}`);
  } finally {
    button.disabled = false;
    document.body.classList.remove("is-exporting");
  }
}

function resetSettings() {
  const settings = { ...DEFAULT_SETTINGS };
  applySettingsToUI(settings);
  saveSettings(settings);
  renderPreview();
}

function bindEvents() {
  elements.inputText.addEventListener("input", renderPreview);
  elements.bigCellSizeCm.addEventListener("input", renderPreview);
  elements.pagePaddingMm.addEventListener("input", renderPreview);
  elements.traceOpacity.addEventListener("input", () => {
    elements.traceOpacityValue.textContent = Number(elements.traceOpacity.value).toFixed(2);
    renderPreview();
  });
  elements.showGridGuides.addEventListener("change", renderPreview);

  elements.generateBtn.addEventListener("click", renderPreview);
  elements.exportPdfBtn.addEventListener("click", exportPdf);
  elements.resetBtn.addEventListener("click", resetSettings);
}

function init() {
  const settings = loadSettings();
  applySettingsToUI(settings);
  bindEvents();
  renderPreview();
}

window.addEventListener("DOMContentLoaded", init);
