# 描紅練字頁產生器

這是一個可直接部署到 **GitHub Pages** 的純前端靜態網站，用來逐字輸入並產生 A4 描紅練字頁，最後可直接匯出成 PDF。

---

## 功能

- 逐字輸入，不自動拆句
- 相同字元可重複輸入，視為獨立模組
- 中文 / 數字 / 標點 / 特殊符號：Huninn
- 英文：Comfortaa
- 缺字時自動 fallback 到系統字體
- 單頁 A4 直式預覽
- 大格大小可調（cm）
- 右側即時預覽
- 直接輸出 PDF
- 記住上次大格尺寸與字體設定（localStorage）

---

## 專案檔案

```text
trace-practice-generator/
├─ index.html
├─ style.css
├─ script.js
├─ README.md
└─ .nojekyll