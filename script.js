const state = {
  chars: [],
  big: 1.5
};

const input = document.getElementById("charInput");
const addBtn = document.getElementById("addCharBtn");
const clearBtn = document.getElementById("clearBtn");
const exportBtn = document.getElementById("exportPdfBtn");
const sizeInput = document.getElementById("bigSizeInput");
const sheet = document.getElementById("sheetContent");
const paper = document.getElementById("paper");

sizeInput.value = state.big;

function isEnglish(c) {
  return /^[A-Za-z]$/.test(c);
}

function fontFor(c) {
  return isEnglish(c)
    ? "'Comfortaa', sans-serif"
    : "'Huninn', 'Microsoft JhengHei', sans-serif";
}

function render() {
  sheet.innerHTML = "";
  const big = state.big;
  const small = big / 2;

  paper.style.setProperty("--big", `${big}cm`);
  paper.style.setProperty("--small", `${small}cm`);

  const cols = Math.floor((21 - big * 2) / (big * 2));

  state.chars.forEach((c, i) => {
    const m = document.createElement("div");
    m.className = "module";
    m.style.left = `${(i % cols) * big * 2}cm`;
    m.style.top = `${Math.floor(i / cols) * big}cm`;

    for (let j = 0; j < 5; j++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = c;
      span.style.fontFamily = fontFor(c);
      span.style.fontSize = j === 0 ? `${big * 24}px` : `${small * 24}px`;
      cell.appendChild(span);
      m.appendChild(cell);
    }

    sheet.appendChild(m);
  });
}

addBtn.onclick = () => {
  const c = Array.from(input.value)[0];
  if (!c) return;
  state.chars.push(c);
  input.value = "";
  render();
};

clearBtn.onclick = () => {
  state.chars = [];
  render();
};

sizeInput.onchange = () => {
  state.big = parseFloat(sizeInput.value);
  render();
};

exportBtn.onclick = async () => {
  const canvas = await html2canvas(paper, { scale: 2 });
  const img = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");
  pdf.addImage(img, "PNG", 0, 0, 210, 297);
  pdf.save(prompt("PDF 檔名", "描紅練字") + ".pdf");
};

render();
