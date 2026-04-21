const SETTINGS_KEY = "trace-practice-generator-settings-v2";

const DEFAULT_SETTINGS = {
  bigCellSizeCm: 1.5,
  fontPreset: "huninn-comfortaa"
};

const state = {
  modules: [],
  settings: loadSettings()
};

const elements = {
  charInput: document.getElementById("charInput"),
  addCharBtn: document.getElementById("addCharBtn"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),
  bigCellSizeCm: document.getElementById("bigCellSizeCm"),
  sizeInfo: document.getElementById("sizeInfo"),
  statusMessage: document.getElementById("statusMessage"),
  previewStage: document.getElementById("previewStage"),
  previewScaler: document.getElementById("previewScaler"),
  previewTransform: document.getElementById("previewTransform"),
  pagePreview: document.getElementById("pagePreview"),
  pageContent: document.getElementById("pageContent"),
  emptyState: document.getElementById("emptyState"),
  moduleTemplate: document.getElementById("moduleTemplate")
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(raw);
    return {
      bigCellSizeCm: clamp(safeNumber(parsed.bigCellSizeCm, DEFAULT_SETTINGS.bigCellSizeCm), 1, 5),
      fontPreset: parsed.fontPreset || DEFAULT_SETTINGS.fontPreset
    };
  } catch (error) {
    console.warn("讀取設定失敗，將使用預設值。", error);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  } catch (error) {
    console.warn("儲存設定失敗。", error);
  }
}

function isLatinCharacter(char) {
  return /^[A-Za-z]$/.test(char);
}

function sanitizeFilename(name) {
  const cleaned = String(name || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();

  return cleaned || "trace-practice-sheet";
}

function splitCharacters(text) {
  return Array.from(text || "").filter((char) => char !== "\r" && char !== "\n");
}

function updateCssVariables() {
  const root = document.documentElement;
  const bigCell = clamp(state.settings.bigCellSizeCm, 1, 5);
  root.style.setProperty("--big-cell-cm", String(bigCell));
  root.style.setProperty("--page-margin-mm", `calc(${bigCell} * 10mm)`);
}

function updateSizeInfo() {
  const big = clamp(state.settings.bigCellSizeCm, 1, 5);
  const small = big / 2;
  elements.sizeInfo.textContent = `大格 ${big.toFixed(1)} cm｜小格 ${small.toFixed(2)} cm｜頁邊距 ${big.toFixed(1)} cm`;
}

function setStatus(message) {
  elements.statusMessage.textContent = message;
}

function applySettingsToUI() {
  elements.bigCellSizeCm.value = state.settings.bigCellSizeCm.toFixed(1);
  updateSizeInfo();
}

function buildModule(char) {
  const fragment = elements.moduleTemplate.content.cloneNode(true);
  const moduleElement = fragment.querySelector(".trace-module");
  const charNodes = fragment.querySelectorAll(".trace-char");
  const fontClass = isLatinCharacter(char) ? "font-latin" : "font-cjk";

  charNodes.forEach((node) => {
    node.textContent = char;
    node.classList.add(fontClass);
  });

  return moduleElement;
}

function renderModules() {
  elements.pageContent.innerHTML = "";

  if (state.modules.length === 0) {
    elements.emptyState.classList.remove("is-hidden");
    setStatus("尚未加入字元。\n大格 1 個，小格 4 個，所有格內都顯示同一字元。\n目前不保留任何空白練習格。");
    updatePreviewScale();
    return;
  }

  elements.emptyState.classList.add("is-hidden");

  state.modules.forEach((char) => {
    elements.pageContent.appendChild(buildModule(char));
  });

  const big = state.settings.bigCellSizeCm;
  setStatus(
    `目前共有 ${state.modules.length} 個字元模組。\n大格 ${big.toFixed(1)} cm，小格 ${(big / 2).toFixed(2)} cm，頁邊距 ${big.toFixed(1)} cm。`
  );

  updatePreviewScale();
}

function addCharactersFromInput() {
  const raw = elements.charInput.value;
  const chars = splitCharacters(raw);

  if (chars.length === 0) {
    setStatus("請先輸入至少 1 個字元，再按「輸入」。");
    elements.charInput.focus();
    return;
  }

  state.modules.push(...chars);
  elements.charInput.value = "";
  renderModules();
  elements.charInput.focus();
}

function clearAllModules() {
  state.modules = [];
  renderModules();
  elements.charInput.focus();
}

function updatePreviewScale() {
  window.requestAnimationFrame(() => {
    const stageWidth = elements.previewStage.clientWidth - 40;
    const stageHeight = elements.previewStage.clientHeight - 40;
    const pageWidth = elements.pagePreview.offsetWidth;
    const pageHeight = elements.pagePreview.offsetHeight;

    if (!pageWidth || !pageHeight || stageWidth <= 0 || stageHeight <= 0) {
      return;
    }

    const scale = Math.min(stageWidth / pageWidth, stageHeight / pageHeight, 1);
    elements.previewScaler.style.width = `${pageWidth * scale}px`;
    elements.previewScaler.style.height = `${pageHeight * scale}px`;
    elements.previewTransform.style.transform = `scale(${scale})`;
  });
}

async function exportPdf() {
  const filenameInput = window.prompt("請輸入 PDF 檔名", "trace-practice-sheet");
  if (filenameInput === null) {
    return;
  }

  const filename = sanitizeFilename(filenameInput);
  elements.exportPdfBtn.disabled = true;
  setStatus("正在產生 PDF，請稍候...");

  try {
    if (typeof window.html2canvas !== "function") {
      throw new Error("html2canvas 尚未載入。");
    }
    if (!window.jspdf || typeof window.jspdf.jsPDF !== "function") {
      throw new Error("jsPDF 尚未載入。");
    }

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

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

    pdf.addImage(imageData, "PNG", 0, 0, 210, 297, undefined, "FAST");
    pdf.save(`${filename}.pdf`);
    setStatus(`PDF 匯出完成：${filename}.pdf`);
  } catch (error) {
    console.error(error);
    setStatus(`PDF 匯出失敗：${error.message}`);
  } finally {
    elements.exportPdfBtn.disabled = false;
  }
}

function handleSizeChange() {
  const value = clamp(safeNumber(elements.bigCellSizeCm.value, state.settings.bigCellSizeCm), 1, 5);
  state.settings.bigCellSizeCm = value;
  saveSettings();
  updateCssVariables();
  applySettingsToUI();
  renderModules();
}

function bindEvents() {
  elements.addCharBtn.addEventListener("click", addCharactersFromInput);
  elements.clearAllBtn.addEventListener("click", clearAllModules);
  elements.exportPdfBtn.addEventListener("click", exportPdf);
  elements.bigCellSizeCm.addEventListener("input", handleSizeChange);
  elements.charInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addCharactersFromInput();
    }
  });
  window.addEventListener("resize", updatePreviewScale);
}

function init() {
  updateCssVariables();
  applySettingsToUI();
  bindEvents();
  renderModules();
  elements.charInput.focus();
}

window.addEventListener("DOMContentLoaded", init);
