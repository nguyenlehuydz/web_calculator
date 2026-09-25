(() => {
  const expressionEl = document.getElementById('expression');
  const resultEl = document.getElementById('result');
  const historyPanel = document.getElementById('historyPanel');
  const historyList = document.getElementById('historyList');
  const historyToggle = document.getElementById('historyToggle');
  const historyClear = document.getElementById('historyClear');
  const historyClose = document.getElementById('historyClose');
  const themeToggle = document.getElementById('themeToggle');
  const copyBtn = document.getElementById('copyBtn');
  const memoryTag = document.getElementById('memoryTag');
  const menuToggle = document.getElementById('menuToggle');
  const modeMenu = document.getElementById('modeMenu');
  const MAX_DIGITS = 14;

  const OP_MAP = { '+': '+', '−': '-', '×': '*', '÷': '/', 'mod': 'mod', '^': '^' };

  // Hai bàn phím khác nhau
  const keypadStandard = document.getElementById('keypad-standard');
  const keypadScientific = document.getElementById('keypad-scientific');

  // Trạng thái dùng chung
  let memory = 0;
  let history = [];
  let activeMode = 'standard'; // 'standard' | 'scientific'

  // Trạng thái riêng cho chế độ Tiêu chuẩn (tính từng bước, như máy tính bỏ túi)
  let current = '0';
  let previous = null;
  let operator = null;
  let overwrite = true;

  // Trạng thái riêng cho chế độ Khoa học (biểu thức đầy đủ, hỗ trợ ngoặc)
  let sciExpr = '';

  const clickSound = new Audio('click_2.mp3');
  clickSound.volume = 0.6;

  function createRipple(e, button) {
    try {
      clickSound.currentTime = 0;
      clickSound.play().catch(() => {});
    } catch (err) {}

    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    const rect = button.getBoundingClientRect();
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - rect.left - radius}px`;
    circle.style.top = `${e.clientY - rect.top - radius}px`;
    circle.classList.add('ripple');

    const existingRipple = button.querySelector('.ripple');
    if (existingRipple) existingRipple.remove();

    button.appendChild(circle);
    setTimeout(() => circle.remove(), 500);
  }

  function formatNumber(numStr) {
    if (numStr === 'Lỗi') return numStr;
    const [intPart, decPart] = numStr.split('.');
    const formattedInt = new Intl.NumberFormat('en-US').format(Number(intPart || 0));
    const sign = numStr.startsWith('-') ? '-' : '';
    const cleanInt = formattedInt.replace('-', '');
    return decPart !== undefined ? `${sign}${cleanInt}.${decPart}` : `${sign}${cleanInt}`;
  }

  function symbolFor(op) {
    return Object.keys(OP_MAP).find(key => OP_MAP[key] === op) || op;
  }

  function pushHistory(expr, result) {
    history.unshift({ expr, result });
    if (history.length > 20) history.pop();
    renderHistory();
  }

  function renderHistory() {
    if (history.length === 0) {
      historyList.innerHTML = '<li class="history-empty">Chưa có phép tính nào</li>';
      return;
    }
    historyList.innerHTML = history.map((h, i) =>
      `<li data-idx="${i}"><span class="h-expr">${h.expr}</span><span class="h-res">= ${formatNumber(h.result)}</span></li>`
    ).join('');
  }

  function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) return NaN;
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  /* ============ CHẾ ĐỘ TIÊU CHUẨN (tính ngay từng bước) ============ */

  function updateDisplay() {
    resultEl.textContent = formatNumber(current);
    if (operator && previous !== null) {
      expressionEl.textContent = `${formatNumber(previous)} ${symbolFor(operator)}`;
    } else {
      expressionEl.textContent = '\u00A0';
    }
    memoryTag.classList.toggle('active', memory !== 0);
  }

  function inputDigit(digit) {
    if (current === 'Lỗi') resetAll(false);
    if (digit === '.') {
      if (overwrite) { current = '0.'; overwrite = false; return updateDisplay(); }
      if (current.includes('.')) return;
      current += '.';
      return updateDisplay();
    }
    if (overwrite) {
      current = digit;
      overwrite = false;
    } else {
      if (current.replace('-', '').replace('.', '').length >= MAX_DIGITS) return;
      current = current === '0' ? digit : current + digit;
    }
    updateDisplay();
  }

  function chooseOperator(opSymbol) {
    if (current === 'Lỗi') return;
    const op = OP_MAP[opSymbol];
    if (operator && !overwrite) compute();
    previous = current;
    operator = op;
    overwrite = true;
    updateDisplay();
  }

  function compute() {
    if (operator === null || previous === null) return;
    const a = parseFloat(previous);
    const b = parseFloat(current);
    let result;
    switch (operator) {
      case '+': result = a + b; break;
      case '-': result = a - b; break;
      case '*': result = a * b; break;
      case '/':
        if (b === 0) { current = 'Lỗi'; previous = null; operator = null; overwrite = true; updateDisplay(); return; }
        result = a / b; break;
      case 'mod': result = a % b; break;
      case '^': result = Math.pow(a, b); break;
      default: return;
    }
    result = Math.round((result + Number.EPSILON) * 1e10) / 1e10;
    const expr = `${formatNumber(previous)} ${symbolFor(operator)} ${formatNumber(current)}`;
    current = String(result);
    pushHistory(expr, current);
    previous = null;
    operator = null;
    overwrite = true;
    updateDisplay();
  }

  function percent() {
    if (current === 'Lỗi') return;
    current = String(parseFloat(current) / 100);
    updateDisplay();
  }

  function deleteLast() {
    if (current === 'Lỗi' || overwrite) { resetAll(false); return; }
    current = current.length > 1 ? current.slice(0, -1) : '0';
    if (current === '-') current = '0';
    updateDisplay();
  }

  function resetAll(hard = true) {
    current = '0';
    if (hard) { previous = null; operator = null; }
    overwrite = true;
    updateDisplay();
  }

  /* ============ CHẾ ĐỘ KHOA HỌC (biểu thức đầy đủ, hỗ trợ ngoặc) ============ */
  // Xây dựng một chuỗi biểu thức (sciExpr) khi người dùng bấm phím, rồi dùng
  // math.js để tính kết quả — nhờ vậy dấu ngoặc và thứ tự ưu tiên phép toán
  // (nhân/chia trước cộng/trừ) được xử lý chính xác, hỗ trợ biểu thức dài
  // kiểu (8 × 3) ÷ 2 + (7 × 4).

  const FUNC_WRAP = {
    square: (t) => `(${t})^2`,
    inverse: (t) => `1/(${t})`,
    abs: (t) => `abs(${t})`,
    exp: (t) => `exp(${t})`,
    sqrt: (t) => `sqrt(${t})`,
    factorial: (t) => `(${t})!`,
    'ten-pow': (t) => `10^(${t})`,
    log: (t) => `log10(${t})`,
    ln: (t) => `log(${t})`,
  };

  function sciLastChar() {
    return sciExpr.slice(-1);
  }

  function sciOpenParenCount(str = sciExpr) {
    let count = 0;
    for (const ch of str) {
      if (ch === '(') count++;
      else if (ch === ')') count--;
    }
    return count;
  }

  function updateSciDisplay() {
    resultEl.textContent = sciExpr === '' ? '0' : sciExpr;
    const preview = sciExpr === '' ? null : sciEvaluateRaw(sciExpr);
    expressionEl.textContent = preview !== null ? `= ${formatNumber(String(preview))}` : '\u00A0';
    memoryTag.classList.toggle('active', memory !== 0);
  }

  function sciEvaluateRaw(exprStr) {
    let s = exprStr.trim();
    if (s === '' || s === '-') return null;
    s = s.replace(/ (mod|[+\-×÷^])\s*$/, '');
    s = s.replace(/-$/, '');
    if (s === '') return null;
    const openCount = sciOpenParenCount(s);
    if (openCount > 0) s += ')'.repeat(openCount);
    const evalStr = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    try {
      const val = math.evaluate(evalStr);
      if (typeof val !== 'number' || !isFinite(val)) return null;
      return Math.round((val + Number.EPSILON) * 1e10) / 1e10;
    } catch (err) {
      return null;
    }
  }

  function sciAppendNumber(token) {
    if (token === '.') {
      const seg = sciExpr.split(/[^0-9.]+/).pop();
      if (seg.includes('.')) return;
      if (seg === '') sciExpr += sciLastChar() === ')' ? ' × 0.' : '0.';
      else sciExpr += '.';
      return updateSciDisplay();
    }
    if (sciLastChar() === ')') {
      sciExpr += ' × ' + token;
    } else {
      sciExpr += token;
    }
    updateSciDisplay();
  }

  function sciAppendConstant(token) {
    sciExpr += /[0-9)]/.test(sciLastChar()) ? ' × ' + token : token;
    updateSciDisplay();
  }

  function sciAppendOpenParen() {
    sciExpr += /[0-9)]/.test(sciLastChar()) ? ' × (' : '(';
    updateSciDisplay();
  }

  function sciAppendCloseParen() {
    if (sciOpenParenCount() <= 0) return;
    if (!/[0-9)]/.test(sciLastChar())) return;
    sciExpr += ')';
    updateSciDisplay();
  }

  function sciAppendOperator(opSymbol) {
    if (sciExpr === '') {
      if (opSymbol === '−') { sciExpr = '-'; updateSciDisplay(); }
      return;
    }
    if (sciExpr === '-') return;
    if (sciLastChar() === '(') {
      if (opSymbol === '−') { sciExpr += '-'; updateSciDisplay(); }
      return;
    }
    const trailOpMatch = sciExpr.match(/ (mod|[+\-×÷^]) $/);
    if (trailOpMatch) {
      sciExpr = sciExpr.slice(0, -trailOpMatch[0].length) + ` ${opSymbol} `;
    } else {
      sciExpr += ` ${opSymbol} `;
    }
    updateSciDisplay();
  }

  function sciBackspace() {
    if (sciExpr === '') return;
    const trailOpMatch = sciExpr.match(/ (mod|[+\-×÷^]) $/);
    sciExpr = trailOpMatch ? sciExpr.slice(0, -trailOpMatch[0].length) : sciExpr.slice(0, -1);
    updateSciDisplay();
  }

  function sciToggleSign() {
    const m = sciExpr.match(/(-?\d+(\.\d+)?)$/);
    if (!m) return;
    const toggled = m[0].startsWith('-') ? m[0].slice(1) : '-' + m[0];
    sciExpr = sciExpr.slice(0, -m[0].length) + toggled;
    updateSciDisplay();
  }

  function sciPercent() {
    const m = sciExpr.match(/(-?\d+(\.\d+)?)$/);
    if (!m) return;
    sciExpr = sciExpr.slice(0, -m[0].length) + String(parseFloat(m[0]) / 100);
    updateSciDisplay();
  }

  function sciExtractTrailingTarget() {
    if (sciExpr.endsWith(')')) {
      let depth = 0;
      for (let i = sciExpr.length - 1; i >= 0; i--) {
        if (sciExpr[i] === ')') depth++;
        else if (sciExpr[i] === '(') depth--;
        if (depth === 0) return sciExpr.slice(i);
      }
    }
    const m = sciExpr.match(/(-?\d+(\.\d+)?)$/);
    return m ? m[0] : null;
  }

  function sciApplyFunc(func) {
    const wrapFn = FUNC_WRAP[func];
    if (!wrapFn) return;
    const target = sciExtractTrailingTarget();
    if (target === null) return;
    sciExpr = sciExpr.slice(0, sciExpr.length - target.length) + wrapFn(target);
    updateSciDisplay();
  }

  function sciCurrentValue() {
    if (sciExpr === '') return 0;
    return sciEvaluateRaw(sciExpr);
  }

  function sciEquals() {
    if (sciExpr === '') return;
    const val = sciEvaluateRaw(sciExpr);
    if (val === null) {
      resultEl.textContent = 'Lỗi';
      expressionEl.textContent = '\u00A0';
      sciExpr = '';
      return;
    }
    pushHistory(sciExpr, String(val));
    sciExpr = String(val);
    updateSciDisplay();
  }

  /* ============ Xử lý sự kiện bàn phím trên màn hình ============ */

  function handleStandardClick(btn) {
    const { num, op, action } = btn.dataset;
    if (num !== undefined) return inputDigit(num);
    if (op !== undefined) return chooseOperator(op);
    switch (action) {
      case 'clear': return resetAll(true);
      case 'delete': return deleteLast();
      case 'percent': return percent();
      case 'equals': return compute();
      case 'mem-clear': memory = 0; return updateDisplay();
      case 'mem-recall': current = String(memory); overwrite = true; return updateDisplay();
      case 'mem-add': memory += parseFloat(current || '0'); return updateDisplay();
      case 'mem-sub': memory -= parseFloat(current || '0'); return updateDisplay();
    }
  }

  function handleSciClick(btn) {
    const { num, op, action, func, kind } = btn.dataset;
    if (func !== undefined) return sciApplyFunc(func);
    if (num !== undefined) return kind === 'const' ? sciAppendConstant(num) : sciAppendNumber(num);
    if (op !== undefined) return sciAppendOperator(op);
    switch (action) {
      case 'clear': sciExpr = ''; return updateSciDisplay();
      case 'delete': return sciBackspace();
      case 'percent': return sciPercent();
      case 'equals': return sciEquals();
      case 'toggle-sign': return sciToggleSign();
      case 'open-paren': return sciAppendOpenParen();
      case 'close-paren': return sciAppendCloseParen();
      case 'mem-clear': memory = 0; return updateSciDisplay();
      case 'mem-recall': return sciAppendConstant(String(memory));
      case 'mem-add': { const v = sciCurrentValue(); if (v !== null) memory += v; return updateSciDisplay(); }
      case 'mem-sub': { const v = sciCurrentValue(); if (v !== null) memory -= v; return updateSciDisplay(); }
    }
  }

  document.querySelectorAll('.keypad').forEach(pad => {
    pad.addEventListener('mousedown', (e) => {
      const btn = e.target.closest('.key');
      if (btn) createRipple(e, btn);
    });
    pad.addEventListener('click', (e) => {
      const btn = e.target.closest('.key');
      if (!btn) return;
      if (pad.id === 'keypad-scientific') handleSciClick(btn);
      else handleStandardClick(btn);
    });
  });

  /* ============ Lịch sử / bộ nhớ / giao diện / chuyển chế độ ============ */

  historyList.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-idx]');
    if (!li) return;
    const item = history[Number(li.dataset.idx)];
    if (activeMode === 'scientific') {
      sciExpr = item.result;
      updateSciDisplay();
    } else {
      current = item.result;
      previous = null;
      operator = null;
      overwrite = true;
      updateDisplay();
    }
    historyPanel.classList.remove('open');
  });

  historyClear.addEventListener('click', () => {
    history = [];
    renderHistory();
    historyPanel.classList.remove('open');
  });

  historyClose.addEventListener('click', () => historyPanel.classList.remove('open'));
  historyToggle.addEventListener('click', () => historyPanel.classList.toggle('open'));
  themeToggle.addEventListener('click', () => document.body.classList.toggle('light'));

  copyBtn.addEventListener('click', async () => {
    const text = resultEl.textContent;
    if (!text || text === 'Lỗi') return;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.classList.add('copied');
      setTimeout(() => copyBtn.classList.remove('copied'), 900);
    } catch (err) {}
  });

  menuToggle.addEventListener('click', () => modeMenu.classList.toggle('show'));

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const mode = e.target.dataset.mode;
      if (mode === 'scientific') {
        keypadStandard.style.display = 'none';
        keypadScientific.style.display = 'grid';
        activeMode = 'scientific';
      } else if (mode === 'standard') {
        keypadStandard.style.display = 'grid';
        keypadScientific.style.display = 'none';
        activeMode = 'standard';
      }
      modeMenu.classList.remove('show');
      current = '0'; previous = null; operator = null; overwrite = true;
      sciExpr = '';
      if (activeMode === 'scientific') updateSciDisplay(); else updateDisplay();
    });
  });

  /* ============ Hỗ trợ bàn phím vật lý ============ */

  function handleStandardKeydown(e) {
    if (e.key >= '0' && e.key <= '9') return inputDigit(e.key);
    if (e.key === '.') return inputDigit('.');
    const opKeyMap = { '+': '+', '-': '−', '*': '×', '/': '÷' };
    if (opKeyMap[e.key]) { e.preventDefault(); return chooseOperator(opKeyMap[e.key]); }
    if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); return compute(); }
    if (e.key === 'Backspace') return deleteLast();
    if (e.key === 'Escape') return resetAll(true);
    if (e.key === '%') return percent();
  }

  function handleSciKeydown(e) {
    if (e.key >= '0' && e.key <= '9') return sciAppendNumber(e.key);
    if (e.key === '.') return sciAppendNumber('.');
    const opKeyMap = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };
    if (opKeyMap[e.key]) { e.preventDefault(); return sciAppendOperator(opKeyMap[e.key]); }
    if (e.key === '(') { e.preventDefault(); return sciAppendOpenParen(); }
    if (e.key === ')') { e.preventDefault(); return sciAppendCloseParen(); }
    if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); return sciEquals(); }
    if (e.key === 'Backspace') return sciBackspace();
    if (e.key === 'Escape') { sciExpr = ''; return updateSciDisplay(); }
    if (e.key === '%') return sciPercent();
  }

  window.addEventListener('keydown', (e) => {
    if (activeMode === 'scientific') handleSciKeydown(e);
    else handleStandardKeydown(e);
  });

  updateDisplay();
})();
