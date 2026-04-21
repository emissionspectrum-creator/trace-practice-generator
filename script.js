"use strict";

/**
 * 描紅練字頁產生器
 * - 單頁 A4 直式
 * - 逐字輸入，不自動拆字
 * - 多模組依序排列；若一列末端放不下，仍佔一個模組位置並由頁面內容區裁切
 * - 預覽與 PDF 使用同一份 DOM 版面
 */

const PAPER_CM = {
  width: 21,
  height: 29.7
};

const STORAGE_KEY = "trace-practice-generator-settings-v1";
const CSS_PX_PER_CM = 96 / 2.54;

const DEFAULT_SETTINGS = {
  bigCm: 1.5,
  fontConfig: {
    han: "Huninn",
    latin: "Comfortaa"
  }
};

const state = {
  chars: [],
  bigCm: DEFAULT_SETTINGS.bigCm,
  fontConfig: { ...DEFAULT_SETTINGS.fontConfig },
  fontsReady: false
};

const elements = {
  charInput: document.getElementById("charInput"),
  addCharBtn: document.getElementById("addCharBtn"),
  clearBtn: document.getElementById("clearBtn"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),
  bigSizeInput: document.getElementById("bigSizeInput"),
  charCount: document.getElementById("charCount"),
  modulesPerRow: document.getElementById("modulesPerRow"),
  visibleRows: document.getElementById("visibleRows"),
  previewViewport: document.getElementById("previewViewport"),
  previewScaleText: document.getElementById("previewScaleText"),
  paperWrapper: document.getElementById("paperWrapper"),
  paper: document.getElementById("paper"),
  sheetContent: document.getElementById("sheetContent"),
  toast: document.getElementById("toast")
};

const measureCanvas = document.createElement("canvas");
const measureContext = measureCanvas.getContext("2d");
const fontSizeCache = new Map();

const graphemeSegmenter = (typeof Intl !== "undefined" && Intl.Segmenter)
  ? new Intl.Segmenter("zh-Hant", { granularity: "grapheme" })
  : null;

let toastTimer = null;
let previewResizeObserver = null;

/* ------------------------------ 工具函式 ------------------------------ */

function cmToPx(cm) {
  return cm * CSS_PX_PER_CM;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatCm(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function getLocalDateText(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function firstGrapheme(input) {
  if (!input) {
    return "";
  }

  if (graphemeSegmenter) {
    const iterator = graphemeSegmenter.segment(input)Symbol.iterator;
    const result = iterator.next();
    return result.done ? "" : result.value.segment;
  }

  return Array.from(input)[0] || "";
}

function isAsciiEnglishLetter(char) {
  return /^[A-Za-z]$/.test(char);
}

function getFontStack(char) {
  const latinFamily = state.fontConfig.latin;
  const hanFamily = state.fontConfig.han;

  if (isAsciiEnglishLetter(char)) {
    return `"${latinFamily}", "Segoe UI", Arial, sans-serif`;
  }

  return `"${hanFamily}", "Noto Sans TC", "Microsoft JhengHei", "PingFang TC", "Heiti TC", sans-serif`;
}

function getSafeTextMetrics(text, fontCss) {
  measureContext.font = fontCss;
  const metrics = measureContext.measureText(text);

  const width = metrics.width;
  const ascent = metrics.actualBoundingBoxAscent || parseFloat(fontCss) * 0.8;
  const descent = metrics.actualBoundingBoxDescent || parseFloat(fontCss) * 0.2;
  const height = ascent + descent;

  return { width, height };
}

function fitFontSizePx(char, boxPx, fontFamily) {
  const cacheKey = `${char}__${boxPx.toFixed(2)}__${fontFamily}`;
  if (fontSizeCache.has(cacheKey)) {
    return fontSizeCache.get(cacheKey);
  }

  // 允許字盡量貼近格線，但避免過度裁切
  const targetWidth = boxPx * 0.985;
  const targetHeight = boxPx * 0.985;

  let low = 1;
  let high = boxPx * 1.5;

  for (let i = 0; i < 28; i += 1) {
    const mid = (low + high) / 2;
    const fontCss = `500 ${mid}px ${fontFamily}`;
    const metrics = getSafeTextMetrics(char, fontCss);

    if (metrics.width <= targetWidth && metrics.height <= targetHeight) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const fitted = Math.max(1, low);
  fontSizeCache.set(cacheKey, fitted);
  return fitted;
}

function computeLayoutMetrics(bigCm) {
  const innerWidthCm = PAPER_CM.width - (bigCm * 2);
  const innerHeightCm = PAPER_CM.height - (bigCm * 2);
  const moduleWidthCm = bigCm * 2;
  const moduleHeightCm = bigCm;

  let modulesPerRow = 0;
  let visibleRows = 0;

  if (innerWidthCm > 0) {
    const fullModules = Math.floor(innerWidthCm / moduleWidthCm);
    const hasClippedModule = (innerWidthCm % moduleWidthCm) > 0.0001;
    modulesPerRow = fullModules + (hasClippedModule ? 1 : 0);

    // 若連完整一個模組都放不下，但內容區仍有寬度，仍可顯示裁切模組
    if (modulesPerRow === 0) {
      modulesPerRow = 1;
    }
  }

  if (innerHeightCm > 0) {
    const fullRows = Math.floor(innerHeightCm / moduleHeightCm);
    const hasClippedRow = (innerHeightCm % moduleHeightCm) > 0.0001;
    visibleRows = fullRows + (hasClippedRow ? 1 : 0);

    if (visibleRows === 0) {
      visibleRows = 1;
    }
  }

  return {
    innerWidthCm,
    innerHeightCm,
    moduleWidthCm,
    moduleHeightCm,
    modulesPerRow,
    visibleRows,
    maxVisibleModules: modulesPerRow * visibleRows
  };
}

function sanitizeFileName(name) {
  let safeName = String(name || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  if (!safeName) {
    return "";
  }

  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safeName)) {
    safeName = `file-${safeName}`;
  }

  return safeName;
}

function createDefaultFileName() {
  return `描紅練字-${getLocalDateText()}`;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");

  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2600);
}

/* ------------------------------ 設定儲存 ------------------------------ */

function loadSettings() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);

    if (typeof parsed.bigCm === "number" && Number.isFinite(parsed.bigCm)) {
      state.bigCm = clamp(parsed.bigCm, 0.5, 5);
    }

    if (parsed.fontConfig && typeof parsed.fontConfig === "object") {
      state.fontConfig = {
        han: typeof parsed.fontConfig.han === "string"
          ? parsed.fontConfig.han
          : DEFAULT_SETTINGS.fontConfig.han,
        latin: typeof parsed.fontConfig.latin === "string"
          ? parsed.fontConfig.latin
          : DEFAULT_SETTINGS.fontConfig.latin
      };
    }
  } catch (error) {
    console.error("讀取設定失敗：", error);
  }
}

function saveSettings() {
  const payload = {
    bigCm: Number(state.bigCm.toFixed(2)),
    fontConfig: { ...state.fontConfig }
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error("儲存設定失敗：", error);
  }
}

/* ------------------------------ DOM 建立 ------------------------------ */

function createCell(className, char, fontFamily, fontSizePx) {
  const cell = document.createElement("div");
  cell.className = className;

  const text = document.createElement("span");
  text.className = "trace-char";
  text.textContent = char;
  text.style.fontFamily = fontFamily;
  text.style.fontSize = `${fontSizePx}px`;

  cell.appendChild(text);
  return cell;
}

function createModule(char, leftCm, topCm, bigCm) {
  const module = document.createElement("div");
  module.className = "module";
  module.style.left = `${leftCm}cm`;
  module.style.top = `${topCm}cm`;

  const fontFamily = getFontStack(char);
  const bigFontSizePx = fitFontSizePx(char, cmToPx(bigCm), fontFamily);
  const smallFontSizePx = bigFontSizePx / 2;

  module.appendChild(createCell("cell big-cell", char, fontFamily, bigFontSizePx));
  module.appendChild(createCell("cell small-1", char, fontFamily, smallFontSizePx));
  module.appendChild(createCell("cell small-2", char, fontFamily, smallFontSizePx));
  module.appendChild(createCell("cell small-3", char, fontFamily, smallFontSizePx));
  module.appendChild(createCell("cell small-4", char, fontFamily, smallFontSizePx));

  return module;
}

/* ------------------------------ 預覽與排版 ------------------------------ */

function updateStatus(metrics) {
  elements.charCount.textContent = String(state.chars.length);
  elements.modulesPerRow.textContent = String(metrics.modulesPerRow);
  elements.visibleRows.textContent = String(metrics.visibleRows);
}

function renderPaper() {
  const bigCm = state.bigCm;
  const smallCm = bigCm / 2;
  const metrics = computeLayoutMetrics(bigCm);

  elements.paper.style.setProperty("--sheet-margin", `${bigCm}cm`);
  elements.paper.style.setProperty("--big-cell", `${bigCm}cm`);
  elements.paper.style.setProperty("--small-cell", `${smallCm}cm`);

  updateStatus(metrics);

  elements.sheetContent.classList.toggle("is-empty", state.chars.length === 0);

  if (metrics.modulesPerRow <= 0 || metrics.visibleRows <= 0) {
    elements.sheetContent.replaceChildren();
    updatePreviewScale();
    return;
  }

  const fragment = document.createDocumentFragment();
  const maxVisible = metrics.maxVisibleModules;
  const visibleChars = state.chars.slice(0, maxVisible);

  for (let index = 0; index < visibleChars.length; index += 1) {
    const row = Math.floor(index / metrics.modulesPerRow);
    const col = index % metrics.modulesPerRow;

    const leftCm = col * metrics.moduleWidthCm;
    const topCm = row * metrics.moduleHeightCm;

    const module = createModule(visibleChars[index], leftCm, topCm, bigCm);
    fragment.appendChild(module);
  }

  elements.sheetContent.replaceChildren(fragment);
  updatePreviewScale();
}

function updatePreviewScale() {
  const availableWidth = elements.previewViewport.clientWidth - 32;
  const availableHeight = elements.previewViewport.clientHeight - 32;

  if (availableWidth <= 0 || availableHeight <= 0) {
    return;
  }

  const paperWidthPx = cmToPx(PAPER_CM.width);
  const paperHeightPx = cmToPx(PAPER_CM.height);

  const scale = Math.min(
    availableWidth / paperWidthPx,
    availableHeight / paperHeightPx,
    1
  );

  const finalScale = Math.max(scale, 0.1);

  elements.paperWrapper.style.width = `${paperWidthPx * finalScale}px`;
  elements.paperWrapper.style.height = `${paperHeightPx * finalScale}px`;
  elements.paper.style.transform = `scale(${finalScale})`;
  elements.previewScaleText.textContent = `預覽縮放 ${Math.round(finalScale * 100)}%`;
}

/* ------------------------------ 互動功能 ------------------------------ */

function addCharacter() {
  const rawInput = elements.charInput.value;

  if (rawInput === "") {
    showToast("請先輸入一個字元。");
    elements.charInput.focus();
    return;
  }

  const char = firstGrapheme(rawInput);

  if (!char) {
    showToast("沒有偵測到可用字元。");
    elements.charInput.focus();
    return;
  }

  state.chars.push(char);
  elements.charInput.value = "";

  renderPaper();
  elements.charInput.focus();

  if (rawInput !== char) {
    showToast("已加入第一個字元；不會自動拆字。");
  }

  const metrics = computeLayoutMetrics(state.bigCm);
  if (state.chars.length === metrics.maxVisibleModules + 1) {
    showToast("超出 A4 可見範圍的模組將依頁面邊界裁切。");
  }
}

function clearAll() {
  if (state.chars.length === 0) {
    return;
  }

  state.chars = [];
  elements.charInput.value = "";
  renderPaper();
  elements.charInput.focus();
}

function applyBigSizeFromInput() {
  const parsed = Number.parseFloat(elements.bigSizeInput.value);

  if (!Number.isFinite(parsed)) {
    return;
  }

  const nextValue = clamp(parsed, 0.5, 5);

  if (Math.abs(nextValue - state.bigCm) < 0.0001) {
    return;
  }

  state.bigCm = nextValue;
  saveSettings();
  renderPaper();
}

function syncBigSizeInput() {
  elements.bigSizeInput.value = formatCm(state.bigCm);
}

async function exportPdf() {
  if (state.chars.length === 0) {
    showToast("目前沒有可輸出的內容。");
    return;
  }

  if (typeof window.html2canvas === "undefined" || !window.jspdf) {
    showToast("PDF 函式庫尚未完成載入，請稍後再試。");
    return;
  }

  const suggestedName = createDefaultFileName();
  const userInputName = window.prompt(
    "請輸入 PDF 檔名（不需要自行輸入 .pdf）",
    suggestedName
  );

  if (userInputName === null) {
    return;
  }

  const finalFileName = sanitizeFileName(userInputName) || suggestedName;

  elements.exportPdfBtn.disabled = true;
  elements.exportPdfBtn.textContent = "輸出中…";

  try {
    await document.fonts.ready;
    state.fontsReady = true;

    document.body.classList.add("exporting");

    const scale = Math.max(2, Math.min(4, (window.devicePixelRatio || 1) * 2));

    const canvas = await window.html2canvas(elements.paper, {
      backgroundColor: "#ffffff",
      scale,
      useCORS: true,
      logging: false
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
    pdf.save(`${finalFileName}.pdf`);
  } catch (error) {
    console.error("PDF 匯出失敗：", error);
    showToast("PDF 輸出失敗，請稍後再試。");
  } finally {
    document.body.classList.remove("exporting");
    elements.exportPdfBtn.disabled = false;
    elements.exportPdfBtn.textContent = "輸出 PDF";
  }
}

/* ------------------------------ 初始化 ------------------------------ */

function bindEvents() {
  elements.addCharBtn.addEventListener("click", addCharacter);

  elements.charInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addCharacter();
    }
  });

  elements.clearBtn.addEventListener("click", clearAll);
  elements.exportPdfBtn.addEventListener("click", exportPdf);

  elements.bigSizeInput.addEventListener("input", applyBigSizeFromInput);
  elements.bigSizeInput.addEventListener("change", applyBigSizeFromInput);
  elements.bigSizeInput.addEventListener("blur", syncBigSizeInput);

  window.addEventListener("resize", updatePreviewScale);

  if ("ResizeObserver" in window) {
    previewResizeObserver = new ResizeObserver(() => {
      updatePreviewScale();
    });
    previewResizeObserver.observe(elements.previewViewport);
  }
}

function init() {
  loadSettings();
  syncBigSizeInput();
  saveSettings();
  renderPaper();
  bindEvents();

  elements.charInput.focus();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready
      .then(() => {
        state.fontsReady = true;
        fontSizeCache.clear();
        renderPaper();
      })
      .catch((error) => {
        console.error("字體載入等待失敗：", error);
      });
  }
}

document.addEventListener("DOMContentLoaded", init);