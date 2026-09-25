(() => {
  const expressionEl = document.getElementById('expression');
  const resultEl = document.getElementById('result');
  const keypad = document.querySelector('.keypad');
  const historyPanel = document.getElementById('historyPanel');
  const historyList = document.getElementById('historyList');
  const historyToggle = document.getElementById('historyToggle');
  const historyClear = document.getElementById('historyClear');
  const historyClose = document.getElementById('historyClose');
  const themeToggle = document.getElementById('themeToggle');
  const copyBtn = document.getElementById('copyBtn');
  const memoryTag = document.getElementById('memoryTag');

  const OP_MAP = { '+': '+', '−': '-', '×': '*', '÷': '/' };
  const MAX_DIGITS = 14;

  let current = '0';
  let previous = null;
  let operator = null;
  let overwrite = true;
  let memory = 0;
  let history = [];

  function formatNumber(numStr) {
    if (numStr === 'Lỗi') return numStr;
    const [intPart, decPart] = numStr.split('.');
    const formattedInt = new Intl.NumberFormat('en-US').format(Number(intPart || 0));
    const sign = numStr.startsWith('-') ? '-' : '';
    const cleanInt = formattedInt.replace('-', '');
    return decPart !== undefined ? `${sign}${cleanInt}.${decPart}` : `${sign}${cleanInt}`;
  }

  function updateDisplay() {
    resultEl.textContent = formatNumber(current);
    if (operator && previous !== null) {
      expressionEl.textContent = `${formatNumber(previous)} ${symbolFor(operator)}`;
    } else {
      expressionEl.textContent = '\u00A0';
    }
    memoryTag.classList.toggle('active', memory !== 0);
  }

  function symbolFor(op) {
    return Object.keys(OP_MAP).find(key => OP_MAP[key] === op) || op;
  }

  function inputDigit(digit) {
    if (current === 'Lỗi') resetAll(false);
    if (digit === '.' ) {
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
    if (operator && !overwrite) {
      compute();
    }
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
        if (b === 0) { current = 'Cannot divide by zero'; previous = null; operator = null; overwrite = true; updateDisplay(); return; }
        result = a / b; break;
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

  historyList.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-idx]');
    if (!li) return;
    const item = history[Number(li.dataset.idx)];
    current = item.result;
    previous = null;
    operator = null;
    overwrite = true;
    updateDisplay();
    historyPanel.classList.remove('open');
  });

  historyClear.addEventListener('click', () => {
    history = [];
    renderHistory();
    historyPanel.classList.remove('open'); // <--- Lệnh này giúp đóng bảng lịch sử
  });

  historyClose.addEventListener('click', () => {
    historyPanel.classList.remove('open');
  });

  historyToggle.addEventListener('click', () => {
    historyPanel.classList.toggle('open');
  });

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(current === 'Lỗi' ? '' : current);
      copyBtn.classList.add('copied');
      setTimeout(() => copyBtn.classList.remove('copied'), 900);
    } catch (err) {
      // clipboard unavailable, ignore silently
    }
  });

  keypad.addEventListener('click', (e) => {
    const btn = e.target.closest('.key');
    if (!btn) return;
    const { num, op, action } = btn.dataset;
    if (num !== undefined) return inputDigit(num);
    if (op !== undefined) return chooseOperator(op);
    switch (action) {
      case 'clear': return resetAll(true);
      case 'delete': return deleteLast();
      case 'percent': return percent();
      case 'equals': return compute();
      case 'mem-clear': memory = 0; return updateDisplay();
      case 'mem-recall':
        current = String(memory);
        overwrite = true;
        return updateDisplay();
      case 'mem-add':
        memory += parseFloat(current || '0');
        return updateDisplay();
      case 'mem-sub':
        memory -= parseFloat(current || '0');
        return updateDisplay();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '9') return inputDigit(e.key);
    if (e.key === '.') return inputDigit('.');
    const opKeyMap = { '+': '+', '-': '−', '*': '×', '/': '÷' };
    if (opKeyMap[e.key]) { e.preventDefault(); return chooseOperator(opKeyMap[e.key]); }
    if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); return compute(); }
    if (e.key === 'Backspace') return deleteLast();
    if (e.key === 'Escape') return resetAll(true);
    if (e.key === '%') return percent();
  });

  updateDisplay();
})();