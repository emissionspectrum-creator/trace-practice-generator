# 描紅練字頁產生器

純前端、可直接部署到 GitHub Pages 的描紅練字頁產生工具。輸入字元後，產生「左 1 大格 + 右 4 小格（2×2）」的固定版型描紅練習頁，並可匯出為 A4 直式 PDF。

- 線上版：https://emissionspectrum-creator.github.io/trace-practice-generator/
- 無建置流程、無相依套件管理，`index.html` / `style.css` / `script.js` 三個檔案即是全部。

---

## 功能

| 項目 | 說明 |
|---|---|
| 字元輸入 | 可一次輸入多個字元，逐字建立描紅模組（按 Enter 或「輸入」鈕） |
| 大格子的大小 | 1.0 – 5.0 cm，step 0.1，預設 1.5 cm |
| 頁邊距 | 0 – 5.0 cm，step 0.1，預設 1.5 cm（**v1.1.0 起可獨立調整**） |
| 全部清除 | 清空目前所有模組 |
| 輸出 PDF | A4 直式，檔名可自訂 |
| 設定保存 | 大格大小與頁邊距存於 localStorage，重新開啟自動沿用 |

### 版型計算

- 小格邊長 = 大格 ÷ 2
- 單一模組寬 = 大格 × 2，高 = 大格
- 每列模組數 = ⌊(210 − 頁邊距×2) ÷ (大格×2)⌋（單位 mm）

以預設值（大格 1.5 cm、頁邊距 1.5 cm）為例：每列 6 個模組、共 17 列。

### 左上角的 1 cm 標尺

頁面左上角有一條標示「1 cm」的黑線，會一併出現在 PDF 中。列印後用尺量這條線，即可確認列印縮放是否正確。

---

## ⚠️ 字型設定（重要）

本工具使用兩套字型，**取得方式不同**：

| 用途 | 字型 | 來源 | 是否需手動安裝 |
|---|---|---|---|
| 中文、全形標點符號 | **隨峰體** The Peak Font | [cjkfonts.io](https://cjkfonts.io/blog/ThePeakFont) | **是，必須手動安裝到系統** |
| 英文、數字、半形符號 | **芫荽** Iansui | Google Fonts（`index.html` 自動載入） | 否 |

### 隨峰體並未包含在本 repo 中

這是刻意的取捨：字型檔為 7.3 MB TTF，放進 repo 會讓每位訪客都得下載數 MB。因此：

- **你的電腦裝了隨峰體** → 中文顯示隨峰體 ✅
- **沒裝隨峰體（含 GitHub Pages 上的訪客）** → 中文自動 fallback 到芫荽 Iansui

CSS 的 fallback 順序已刻意將芫荽排在隨峰體之後，確保退而求其次時仍是硬筆楷書，而非黑體：

```css
--font-cjk: "隨峰體", "The Peak Font 隨峰體 Beta", "Iansui", "Noto Sans TC", sans-serif;
--font-latin: "Iansui", "Segoe UI", Arial, sans-serif;
```

### 安裝隨峰體

從 [cjkfonts.io 隨峰體頁面](https://cjkfonts.io/blog/ThePeakFont) 下載後解壓縮，得到 `ThePeakFontBeta_V0_102.ttf`。

**Linux**
```bash
mkdir -p ~/.local/share/fonts
cp ThePeakFontBeta_V0_102.ttf ~/.local/share/fonts/
fc-cache -f ~/.local/share/fonts

# 驗證
fc-list | grep -i peak
# 應輸出：... : 隨峰體,The Peak Font 隨峰體 Beta:style=Regular
```

**Windows** — 對字型檔按右鍵 →「安裝」
**macOS** — 雙擊字型檔 → 在「字體簿」中點「安裝字體」

安裝後**必須重新啟動瀏覽器**，新字型才會被偵測到。

### 若想讓所有訪客都看到隨峰體

需將字型轉為 woff2 並提交進 repo：

```bash
pip install fonttools brotli
mkdir -p fonts
fonttools ttLib.woff2 compress -o fonts/ThePeakFont.woff2 ThePeakFontBeta_V0_102.ttf
```

再於 `style.css` 加入 `@font-face`（`src` 先寫 `local()` 讓已安裝者零延遲）：

```css
@font-face {
  font-family: "ThePeakFont";
  src: local("隨峰體"),
       local("The Peak Font 隨峰體 Beta"),
       url("./fonts/ThePeakFont.woff2") format("woff2");
  font-display: swap;
}
```

依 SIL OFL 規定，散布字型時必須一併附上 `OFL.txt`。

---

## 字元分流規則

`script.js` 的 `isLatinCharacter()` 決定每個字元套用哪套字型：

```js
function isLatinCharacter(char) {
  return /^[\x21-\x7E]$/.test(char);
}
```

`\x21`–`\x7E` 涵蓋所有**可見的半形 ASCII 字元**：

| 分類 | 範例 | 套用字型 |
|---|---|---|
| 半形英文字母 | `A` `z` | 芫荽 Iansui |
| 半形數字 | `0` `5` | 芫荽 Iansui |
| 半形符號 | `!` `?` `@` `#` `-` | 芫荽 Iansui |
| 中文字 | `中` `字` | 隨峰體 |
| 全形標點符號 | `，` `。` `！` `「` `」` `（` `）` `…` `—` `、` | 隨峰體 |

要改變分流，只需調整這一條 regex。

---

## 本機執行

```bash
git clone https://github.com/emissionspectrum-creator/trace-practice-generator.git
cd trace-practice-generator
python3 -m http.server 8000 --bind 127.0.0.1
```

接著開啟 http://localhost:8000

> **不要直接用瀏覽器開啟 `index.html`（`file://` 協定）。**
> Chrome / Brave 在 `file://` 下會因 CORS 限制擋掉 `@font-face` 的字型載入，且失敗時不會有明顯錯誤訊息。務必透過 HTTP 伺服器存取。

本機執行仍需連網，因為 Google Fonts（芫荽）與 cdnjs（html2canvas、jsPDF）都是外部載入。

---

## 部署

- 所有檔案放在 repo 根目錄
- GitHub Pages → main / root
- `.nojekyll` 已存在，避免 Jekyll 處理檔案

---

## 注意事項與已知限制

### 1. PDF 是點陣圖，不是向量文字

匯出流程為 `html2canvas` 將預覽區截圖成 PNG（`scale: 2`），再用 `jsPDF` 貼滿整張 A4。因此：

- PDF 中的文字**無法選取、無法搜尋**
- 標稱解析度約 **192 DPI**（96 CSS dpi × scale 2），低於印刷級的 300 DPI。用於描紅練習足夠，但放大檢視會看到鋸齒
- 沒有字型嵌入邏輯 —— **畫面上看到什麼字型，PDF 就是什麼字型**。這也是為什麼字型必須先安裝好

若需提高解析度，可調高 `script.js` 中 `html2canvas` 的 `scale` 值，代價是記憶體用量與匯出時間顯著上升。

### 2. 只有單一頁，超出的內容會被裁掉

`.page-content` 設有 `overflow: hidden`，且沒有分頁邏輯。輸入的字元數超過一頁容量時，**多出來的模組會被靜默裁切，不會有任何警告**。請自行控制每次輸入的字數。

### 3. 列印時務必設為「實際大小」

列印 PDF 時請將縮放設為「實際大小 / 100%」，切勿使用「符合頁面 / Fit to page」，否則 cm 尺寸會失準，失去描紅練習的意義。可用左上角的 1 cm 標尺驗證。

### 4. 數字輸入框會即時格式化回填

「大格子的大小」與「頁邊距」在每次 `input` 事件都會被格式化後寫回欄位，因此**無法清空欄位重新輸入**（清空會立即被重置為最小值）。請改用上下箭頭調整，或選取全部後直接覆寫。此為既有行為，尚未修正。

### 5. 頁邊距與大格大小不再連動

v1.1.0 起，調整「大格子的大小」**不會**再連帶改變頁邊距。若兩者都設得很大（例如大格 5 cm、頁邊距 5 cm），每列將只放得下 1 個模組。

### 6. 設定存放於 localStorage

鍵名為 `trace-practice-generator-settings-v2`。清除瀏覽器資料會將設定重置為預設值。

### 7. 隨峰體目前仍是 Beta

版本 v0.102（2025-03-13），作者仍在持續修正字形。

---

## 更新紀錄

### v1.1.0 — 2026-07-26

**字型全面更換**

- 中文與全形標點符號：`Huninn` → **隨峰體 The Peak Font**（改為系統安裝，不再由 Google Fonts 載入）
- 英文、數字與半形符號：`Comfortaa` → **芫荽 Iansui**（Google Fonts）
- 移除 Huninn 與 Comfortaa 兩個 Google Fonts `<link>`，改為單一 Iansui 請求
- 字元分流規則由 `/^[A-Za-z]$/` 擴大為 `/^[\x21-\x7E]$/`
  → **行為改變**：數字與半形標點符號由原本的中文字型改套用英文字型
- `.trace-char.font-latin` 的 `font-weight` 由 `500` 改為 `400`
  （`500` 原為可變字重的 Comfortaa 而設；芫荽為單一字重，保留 `500` 可能觸發合成粗體）

**新增頁邊距獨立調整**

- 新增「頁邊距（cm）」輸入框，範圍 0 – 5 cm，預設 1.5 cm
- 新增設定項 `pageMarginCm`，一併保存於 localStorage
- → **行為改變**：頁邊距原本是大格大小的衍生值（`--page-margin-mm` 直接等於 `--big-cell-mm`），現已完全獨立
- → **升級注意**：既有 localStorage 中沒有 `pageMarginCm` 鍵，升級後頁邊距會回到預設的 1.5 cm。若先前依賴「頁邊距跟隨大格」的版面，需手動調整回來

### v1.0.0 — 2026-04-22

- 初版：一大四小固定版型、A4 直式預覽、純前端 PDF 匯出
- 字型組合為 Huninn（中文／數字／標點）+ Comfortaa（英文）
- 大格大小可調（1 – 5 cm），頁邊距自動等於大格大小

---

## 技術細節

| 項目 | 內容 |
|---|---|
| 前端 | 原生 HTML / CSS / JavaScript，無框架、無建置流程 |
| 截圖 | [html2canvas 1.4.1](https://cdnjs.com/libraries/html2canvas)（cdnjs） |
| PDF | [jsPDF 2.5.1 UMD](https://cdnjs.com/libraries/jspdf)（cdnjs） |
| 版面 | CSS Grid + 負 margin 折疊格線；預覽縮放優先使用 `zoom`，不支援時退回 `transform: scale()` |
| 匯出前置 | 等待 `document.fonts.ready`，確保字型載入完成後才截圖 |

---

## 授權

### 專案程式碼

本 repo 尚未指定授權條款。

### 字型

兩套字型皆採 **SIL Open Font License 1.1**，可免費使用（含商用）：

- **隨峰體 The Peak Font** — 作者阿坤，以啫喱筆手寫兩年而成，約 6,100 字。https://cjkfonts.io/blog/ThePeakFont
- **芫荽 Iansui** — 作者 But Ko，基於 Fontworks 的 Klee One 改作，貼近教育部標準字體寫法的繁體硬筆楷書。https://github.com/ButTaiwan/iansui

本 repo 目前**未散布任何字型檔**，故不涉及 OFL 的隨附授權文件義務。若日後將字型檔提交進 repo，必須一併附上該字型的 `OFL.txt`。依 OFL 規定，禁止單獨出售字型檔。
