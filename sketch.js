let table; // p5.Table 題庫
let allQuestions = []; // 由 table 轉成的題目陣列
let quizQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let quizState = 'IDLE'; // IDLE, QUIZ, RESULT

const NUM_QUESTIONS = 5;

// 天空相關
const NUM_CLOUDS = 6;
let clouds = [];
let sunX = 0, sunY = 0;

function preload() {
  table = loadTable('questions.csv', 'csv', 'header',
    () => { /* success */ },
    () => { /* error: setup 會處理 */ }
  );
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('Arial');
  // 初始化太陽與雲朵
  sunX = width * 0.18;
  sunY = height * 0.18;
  clouds = [];
  for (let i = 0; i < NUM_CLOUDS; i++) {
    clouds.push({
      x: random(-200, width + 200),
      y: random(height * 0.05, height * 0.55),
      size: random(120, 300),
      speed: random(0.2, 1.0),
      alpha: random(160, 255)
    });
  }

  if (!table || table.getRowCount() === 0) generateTable();
  loadQuestionsFromTable();
  resetQuiz();
  quizState = 'IDLE';
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  sunX = width * 0.18;
  sunY = height * 0.18;
  // 調整雲朵數量/位置以符合新尺寸
  if (clouds.length < NUM_CLOUDS) {
    for (let i = clouds.length; i < NUM_CLOUDS; i++) {
      clouds.push({
        x: random(-200, width + 200),
        y: random(height * 0.05, height * 0.55),
        size: random(120, 300),
        speed: random(0.2, 1.0),
        alpha: random(160, 255)
      });
    }
  }
}

function draw() {
  // 動態參數（依畫面大小縮放）
  const base = min(width, height);
  const s = constrain(base / 900, 0.6, 1.6); // 縮放係數
  const titleSize = 40 * s;
  const subtitleSize = 18 * s;
  const optionHeight = 48 * s;
  const optionWidth = width * 0.72;
  const optionStartY = height * 0.22;
  const smallText = 14 * s;

  // 儲存到全域方便互動使用（每次 draw 會更新）
  window._UI = { s, titleSize, subtitleSize, optionHeight, optionWidth, optionStartY, smallText };

  drawSkyBackground();

  cursor(ARROW);

  if (quizState === 'IDLE') drawIdle();
  else if (quizState === 'QUIZ') displayQuiz();
  else if (quizState === 'RESULT') displayResult();

  drawDownloadButton();
}

/* ---------- 題庫 ---------- */
function generateTable() {
  table = new p5.Table();
  table.addColumn('Question');
  table.addColumn('OptionA');
  table.addColumn('OptionB');
  table.addColumn('OptionC');
  table.addColumn('OptionD');
  table.addColumn('CorrectAnswer');

  addRow(table, "p5.js 中用來畫直線的函式是？", "line()", "rect()", "ellipse()", "stroke()", "A");
  addRow(table, "在 p5.js 中，setup() 何時被呼叫？", "程式開始時一次", "每一幀都會呼叫", "當滑鼠點擊時", "當視窗改變大小時", "A");
  addRow(table, "draw() 在 p5.js 的用途是？", "初始化變數", "每一幀渲染與動畫更新", "讀取外部檔案", "停止程式", "B");
  addRow(table, "下列哪一個用來建立畫布大小？", "createCanvas()", "setCanvasSize()", "canvas()", "initCanvas()", "A");
  addRow(table, "代表滑鼠 X 座標的變數是？", "mouseX", "mouseY", "pmouseX", "mousePosX", "A");
  addRow(table, "要在畫布上畫圓，常用的函式是？", "rect()", "line()", "ellipse()", "point()", "C");
  addRow(table, "要改變填滿顏色應使用哪個函式？", "stroke()", "noStroke()", "background()", "fill()", "D");
  addRow(table, "當視窗大小改變時，要調整畫布應在何函式內呼叫 resizeCanvas？", "setup()", "draw()", "windowResized()", "preload()", "C");
  addRow(table, "在 p5.js 中，使用哪個函式可以載入外部圖片？", "loadImage()", "getImage()", "fetchImage()", "imageLoad()", "A");
}

function addRow(tbl, q, a, b, c, d, correct) {
  let r = tbl.addRow();
  r.setString('Question', q);
  r.setString('OptionA', a);
  r.setString('OptionB', b);
  r.setString('OptionC', c);
  r.setString('OptionD', d);
  r.setString('CorrectAnswer', correct);
}

function loadQuestionsFromTable() {
  allQuestions = [];
  if (!table) return;

  function findHeader(cands) {
    for (let h of table.columns) {
      if (cands.indexOf(h.toLowerCase()) !== -1) return h;
    }
    return null;
  }
  let hQ = findHeader(['question']) || table.columns[0];
  let hA = findHeader(['a','optiona']) || 'OptionA';
  let hB = findHeader(['b','optionb']) || 'OptionB';
  let hC = findHeader(['c','optionc']) || 'OptionC';
  let hD = findHeader(['d','optiond']) || 'OptionD';
  let hAns = findHeader(['answer','correctanswer']) || 'CorrectAnswer';

  for (let i = 0; i < table.getRowCount(); i++) {
    let row = table.getRow(i);
    let qText = row.getString(hQ);
    let optA = row.getString(hA);
    let optB = row.getString(hB);
    let optC = row.getString(hC);
    let optD = row.getString(hD);
    let correct = row.getString(hAns);
    if (typeof correct === 'string') correct = correct.trim().toUpperCase().charAt(0);
    allQuestions.push({
      question: qText || `題目 ${i+1}`,
      options: { A: optA, B: optB, C: optC, D: optD },
      correct: correct || 'A'
    });
  }
}

/* ---------- 流程 ---------- */
function resetQuiz() {
  let available = [...allQuestions];
  quizQuestions = [];
  for (let i = 0; i < NUM_QUESTIONS && available.length > 0; i++) {
    let idx = floor(random(available.length));
    quizQuestions.push(available[idx]);
    available.splice(idx, 1);
  }
  score = 0;
  currentQuestionIndex = 0;
}

/* ---------- UI 繪製 ---------- */
function drawDownloadButton() {
  const { s, smallText } = window._UI || { s:1, smallText:14 };
  let bx = width - 140;
  let by = 36 * s;
  let bw = 240 * min(1, s);
  let bh = 44 * s;
  let x1 = bx - bw/2;
  let y1 = by - bh/2;
  if (mouseX > x1 && mouseX < x1 + bw && mouseY > y1 && mouseY < y1 + bh) {
    fill(70,130,180);
    cursor(HAND);
  } else fill(100);
  noStroke();
  rect(x1, y1, bw, bh, 8);
  fill(255);
  textSize(smallText);
  textAlign(CENTER, CENTER);
  text('下載題庫 (generated_quiz.csv)', bx, by);
}

// 新增：繪製白色文字畫布（含陰影）
function drawWhitePanel(cx, cy, w, h, r = 16) {
  // shadow
  push();
  noStroke();
  fill(0, 0, 0, 28);
  rectMode(CENTER);
  rect(cx + 6, cy + 8, w, h, r);
  // white panel
  fill(255);
  rect(cx, cy, w, h, r);
  pop();
}

// 修改 drawIdle：在白色畫布內放文字與按鈕
function drawIdle() {
  const { s, titleSize, subtitleSize } = window._UI || { s:1, titleSize:40, subtitleSize:18 };
  // panel 大小與位置
  let panelW = min(1000, width * 0.72);
  let panelH = min(520, height * 0.48);
  let cx = width / 2;
  let cy = height * 0.22 + panelH / 2;

  drawWhitePanel(cx, cy, panelW, panelH, 14);

  // 文字與按鈕在 panel 範圍內排版
  fill(30);
  textSize(titleSize);
  textAlign(CENTER, TOP);
  text('互動測驗示範', cx, cy - panelH/2 + 28 * s);

  textSize(subtitleSize);
  textAlign(CENTER, TOP);
  text('按任意空白區或點擊下方「開始測驗」以開始（題庫也可下載）',
       cx, cy - panelH/2 + 28 * s + titleSize + 8 * s, panelW * 0.88);

  // 開始按鈕（放在白色畫布內下方）
  let bw = min(520, panelW * 0.42);
  let bh = 72 * s;
  let bx = cx;
  let by = cy + panelH/2 - bh - 18 * s;
  let x1 = bx - bw/2;
  let y1 = by - bh/2;
  if (mouseX > x1 && mouseX < x1 + bw && mouseY > y1 && mouseY < y1 + bh) {
    fill(80,160,100);
    cursor(HAND);
  } else fill(60,130,80);
  noStroke();
  rect(x1, y1, bw, bh, 12);
  fill(255);
  textSize(20 * s);
  textAlign(CENTER, CENTER);
  text('開始測驗', bx, by);
}

// 修改 displayQuiz：確保題目與選項皆置於白色畫布
function displayQuiz() {
  if (currentQuestionIndex >= quizQuestions.length) {
    quizState = 'RESULT';
    return;
  }
  const { s, titleSize, subtitleSize, smallText } = window._UI || { s:1, titleSize:40, subtitleSize:18, smallText:14 };
  let q = quizQuestions[currentQuestionIndex];

  // panel 大小與位置（置中）
  let panelW = min(1200, width * 0.88);
  let panelH = min(820, height * 0.78);
  let cx = width/2;
  let cy = height/2;

  drawWhitePanel(cx, cy, panelW, panelH, 18);

  // 標題與題目（置中於 panel 上半部）
  fill(30);
  textSize(titleSize * 0.55);
  textAlign(CENTER, TOP);
  text(`第 ${currentQuestionIndex + 1} 題 / 共 ${NUM_QUESTIONS} 題`, cx, cy - panelH/2 + 18 * s);

  textSize(subtitleSize * 1.02);
  wrapText(q.question, cx - panelW * 0.36, cy - panelH/2 + 18 * s + titleSize * 0.7, panelW * 0.72, subtitleSize * 1.6);

  // 計算選項大小與置中：縮小寬度、垂直置中在 panel 中段
  let keys = ['A','B','C','D'];
  let optionWidth = min(panelW * 0.68, width * 0.6); // 縮小選項寬度
  let optionHeight = max(36 * s, 40 * s); // 小一些但依螢幕縮放
  let gap = 12 * s;
  let totalHeight = keys.length * optionHeight + (keys.length - 1) * gap;
  let startTop = cy - totalHeight / 2; // 垂直置中

  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    let optionText = `${key}. ${q.options[key]}`;
    let x = cx;
    let y = startTop + i * (optionHeight + gap) + optionHeight / 2;
    let x1 = x - optionWidth/2;
    let y1 = y - optionHeight/2;

    // hover
    if (mouseX > x1 && mouseX < x1 + optionWidth && mouseY > y1 && mouseY < y1 + optionHeight) {
      fill(220, 240, 255);
      cursor(HAND);
    } else fill(250);

    stroke(190);
    rect(x1, y1, optionWidth, optionHeight, 10);

    noStroke();
    fill(30);
    textAlign(LEFT, CENTER);
    textSize(14 * s); // 選項文字較小
    // 行寬限制避免超出選項：使用 wrapText 於選項內顯示（若過長）
    let tx = x1 + 14 * s;
    let maxW = optionWidth - 28 * s;
    // 單行或多行顯示
    wrapText(optionText, tx, y - optionHeight/2 + 8 * s, maxW, 16 * s);

    textAlign(CENTER, CENTER);

    if (!q.options) q.options = {};
    q.options[key + 'Rect'] = { x1: x1, y1: y1, x2: x1 + optionWidth, y2: y1 + optionHeight, key: key };
  }

  // 目前答對數放在 panel 左下角
  fill(80);
  textSize(smallText);
  textAlign(LEFT, BOTTOM);
  text(`目前答對： ${score}`, cx - panelW/2 + 18, cy + panelH/2 - 12);
  textAlign(CENTER, CENTER);
}

// 修改 displayResult：結果與「再測一次」放在白色畫布
function displayResult() {
  const { s, titleSize, subtitleSize, smallText } = window._UI;
  // panel for result
  let panelW = min(1100, width * 0.78);
  let panelH = min(700, height * 0.66);
  let cx = width/2;
  let cy = height/2;

  drawWhitePanel(cx, cy, panelW, panelH, 16);

  let percentage = (score / NUM_QUESTIONS) * 100;
  let feedback = '';
  let col = color(50);

  if (percentage === 100) { feedback = '太棒了！滿分通過！🎉'; col = color(0,160,0); }
  else if (percentage >= 75) { feedback = '表現優異！做得非常好！👍'; col = color(0,110,200); }
  else if (percentage >= 50) { feedback = '還不錯！繼續努力！👏'; col = color(220,120,0); }
  else { feedback = '需要多加溫習囉！加油！💪'; col = color(200,50,50); }

  fill(30);
  textSize(titleSize * 0.7);
  textAlign(CENTER, TOP);
  text('測驗結果', cx, cy - panelH/2 + 18 * s);

  textSize(titleSize * 1.1);
  fill(col);
  text(`${score} / ${NUM_QUESTIONS}`, cx, cy - panelH/2 + 18 * s + titleSize * 0.9);

  textSize(subtitleSize * 1.15);
  fill(50);
  text(feedback, cx, cy - panelH/2 + 18 * s + titleSize * 1.9);

  // 再測一次按鈕放在 panel 底部
  let bw = min(420, panelW * 0.32);
  let bh = 64 * s;
  let bx = cx;
  let by = cy + panelH/2 - bh - 18 * s;
  let x1 = bx - bw/2;
  let y1 = by - bh/2;
  if (mouseX > x1 && mouseX < x1 + bw && mouseY > y1 && mouseY < y1 + bh) { fill(90,160,110); cursor(HAND); }
  else fill(70,130,100);
  noStroke();
  rect(x1, y1, bw, bh, 12);
  fill(255);
  textSize(22 * s);
  text('再測一次', bx, by);

  // 題目清單放在 panel 內中段
  fill(80);
  textSize(smallText);
  textAlign(CENTER, TOP);
  text('題目清單（參考）', cx, cy - panelH/2 + 18 * s + titleSize * 2.8);
  textAlign(LEFT, TOP);
  let startY = cy - panelH/2 + 18 * s + titleSize * 3.4;
  for (let i = 0; i < quizQuestions.length; i++) {
    let tq = quizQuestions[i];
    let txt = `${i+1}. ${tq.question}   正確：${tq.correct}`;
    wrapText(txt, cx - panelW/2 + 20, startY + i * (smallText * 1.6), panelW - 40, smallText * 1.6);
  }
  textAlign(CENTER, CENTER);
}

/* ---------- 互動 ---------- */
function mousePressed() {
  // 下載按鈕
  const { s } = window._UI || { s:1 };
  let dbx = width - 140;
  let dby = 36 * s;
  let dbw = 240 * min(1, s);
  let dbh = 44 * s;
  let dx1 = dbx - dbw/2;
  let dy1 = dby - dbh/2;
  if (mouseX > dx1 && mouseX < dx1 + dbw && mouseY > dy1 && mouseY < dy1 + dbh) {
    if (table) saveTable(table, 'generated_quiz.csv', 'csv');
    return;
  }

  if (quizState === 'IDLE') {
    resetQuiz();
    quizState = 'QUIZ';
    return;
  }

  if (quizState === 'QUIZ') {
    checkAnswer();
    return;
  }

  if (quizState === 'RESULT') {
    // 再測一次按鈕
    let bw = min(420, width * 0.32);
    let bh = 64 * s;
    let bx = width/2;
    let by = height * 0.72;
    let x1 = bx - bw/2;
    let y1 = by - bh/2;
    if (mouseX > x1 && mouseX < x1 + bw && mouseY > y1 && mouseY < y1 + bh) {
      resetQuiz();
      quizState = 'QUIZ';
    }
    return;
  }
}

function checkAnswer() {
  let q = quizQuestions[currentQuestionIndex];
  if (!q) return;
  let keys = ['A','B','C','D'];
  for (let k of keys) {
    let r = q.options ? q.options[k + 'Rect'] : null;
    if (r && mouseX > r.x1 && mouseX < r.x2 && mouseY > r.y1 && mouseY < r.y2) {
      if (k === q.correct) score++;
      currentQuestionIndex++;
      if (currentQuestionIndex >= NUM_QUESTIONS || currentQuestionIndex >= quizQuestions.length) quizState = 'RESULT';
      break;
    }
  }
}

/* ---------- 背景天空 ---------- */
function drawSkyBackground() {
  // 天空漸層
  let topCol = color(20, 140, 255);
  let midCol = color(100, 190, 255);
  let botCol = color(200, 230, 255);
  for (let y = 0; y <= height; y++) {
    let amt = map(y, 0, height, 0, 1);
    let c;
    if (amt < 0.6) c = lerpColor(topCol, midCol, amt / 0.6);
    else c = lerpColor(midCol, botCol, (amt - 0.6) / 0.4);
    stroke(c);
    line(0, y, width, y);
  }

  noStroke();

  // 太陽光暈
  let sunCol = color(255, 220, 120, 200);
  for (let r = 220; r > 20; r -= 40) {
    fill(red(sunCol), green(sunCol), blue(sunCol), map(r, 220, 20, 20, 200));
    ellipse(sunX, sunY, r, r * 0.8);
  }
  fill(255, 245, 200);
  ellipse(sunX, sunY, 60, 60);

  // 雲朵
  for (let c of clouds) {
    c.x += c.speed * 0.6;
    if (c.x - c.size > width + 200) {
      c.x = -200 - random(50);
      c.y = random(height * 0.05, height * 0.55);
      c.size = random(120, 300);
      c.speed = random(0.2, 1.0);
      c.alpha = random(160, 255);
    }

    push();
    translate(c.x, c.y);
    fill(255, c.alpha);
    noStroke();
    let s = c.size;
    ellipse(-s * 0.35, 0, s * 0.6, s * 0.45);
    ellipse(0, 0, s, s * 0.6);
    ellipse(s * 0.4, 0, s * 0.7, s * 0.5);
    ellipse(s * 0.8, 0, s * 0.45, s * 0.35);
    fill(230, c.alpha * 0.7);
    ellipse(0, s * 0.12, s * 0.9, s * 0.45);
    pop();
  }

  // 前景光暈
  fill(255, 255, 255, 10);
  ellipse(width * 0.5, height * 0.95, width * 0.9, 160);
}

/* ---------- 工具：文字自動換行 ---------- */
function wrapText(txt, x, y, maxW, lineH) {
  textSize(lineH * 0.9);
  textAlign(LEFT, TOP);
  let words = txt.split(' ');
  let line = '';
  let yy = y;
  for (let n = 0; n < words.length; n++) {
    let testLine = line + words[n] + ' ';
    let tw = textWidth(testLine);
    if (tw > maxW && n > 0) {
      text(line, x, yy);
      line = words[n] + ' ';
      yy += lineH;
    } else {
      line = testLine;
    }
  }
  text(line, x, yy);
}
