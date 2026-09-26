(() => {
  'use strict';

  /* ======================================================== */
  /* GLOBAL STATE & SOUND SYNTHESIS                          */
  /* ======================================================== */
  let soundEnabled = true;
  let angleUnit = 'DEG'; // 'DEG' | 'RAD'
  let precision = 10;
  let activeView = 'standard'; // 'standard' | 'scientific' | 'programmer' | 'converter' | 'matrix' | ...

  // Audio Context synthesizer for click sounds (fallback when mp3 not present)
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioCtx = new AudioCtx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  const clickAudio = new Audio('click_2.mp3');
  clickAudio.volume = 0.5;

  function playClick() {
    if (!soundEnabled) return;
    try {
      clickAudio.currentTime = 0;
      const playPromise = clickAudio.play();
      if (playPromise) {
        playPromise.catch(() => {
          synthesizeClick();
        });
      }
    } catch (e) {
      synthesizeClick();
    }
  }

  function synthesizeClick() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.025);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.025);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    } catch (err) {}
  }

  function createRipple(e, button) {
    playClick();
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
    setTimeout(() => circle.remove(), 450);
  }

  /* ======================================================== */
  /* DOM ELEMENTS                                             */
  /* ======================================================== */
  const stageEl = document.getElementById('stage');
  const currentModeTitle = document.getElementById('currentModeTitle');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const sidebarDrawer = document.getElementById('sidebarDrawer');
  const menuToggle = document.getElementById('menuToggle');
  const sidebarClose = document.getElementById('sidebarClose');

  const historyPanel = document.getElementById('historyPanel');
  const historyList = document.getElementById('historyList');
  const historyToggle = document.getElementById('historyToggle');
  const historyClear = document.getElementById('historyClear');
  const historyClose = document.getElementById('historyClose');
  const sidebarHistoryBtn = document.getElementById('sidebarHistoryBtn');

  const themeToggle = document.getElementById('themeToggle');
  const settingsModal = document.getElementById('settingsModal');
  const settingsToggle = document.getElementById('settingsToggle');
  const settingsClose = document.getElementById('settingsClose');
  const sidebarSettingsBtn = document.getElementById('sidebarSettingsBtn');

  const settingSoundToggle = document.getElementById('settingSoundToggle');
  const settingThemeToggle = document.getElementById('settingThemeToggle');
  const settingAngleUnit = document.getElementById('settingAngleUnit');
  const settingPrecision = document.getElementById('settingPrecision');

  /* Calculator View Elements */
  const expressionEl = document.getElementById('expression');
  const resultEl = document.getElementById('result');
  const copyBtn = document.getElementById('copyBtn');
  const memoryTag = document.getElementById('memoryTag');
  const keypadStandard = document.getElementById('keypad-standard');
  const keypadScientific = document.getElementById('keypad-scientific');
  const sciAngleUnitBtn = document.getElementById('sciAngleUnitBtn');

  /* Shared History */
  let history = [];

  function pushHistory(expr, res) {
    history.unshift({ expr, result: String(res), time: new Date().toLocaleTimeString() });
    if (history.length > 25) history.pop();
    renderHistory();
  }

  function renderHistory() {
    if (history.length === 0) {
      historyList.innerHTML = '<li class="history-empty">Chưa có phép tính nào</li>';
      return;
    }
    historyList.innerHTML = history.map((h, i) =>
      `<li data-idx="${i}">
        <span class="h-expr">${h.expr}</span>
        <span class="h-res">= ${formatNumber(h.result)}</span>
      </li>`
    ).join('');
  }

  function formatNumber(numStr) {
    if (numStr === 'Lỗi' || numStr === 'Error' || numStr === 'Infinity' || numStr === '-Infinity' || numStr === 'NaN') return numStr;
    const parts = String(numStr).split('.');
    const intPart = parts[0];
    const decPart = parts[1];
    const formattedInt = new Intl.NumberFormat('en-US').format(Number(intPart || 0));
    const sign = numStr.startsWith('-') && !formattedInt.startsWith('-') ? '-' : '';
    const cleanInt = formattedInt.replace('-', '');
    return decPart !== undefined ? `${sign}${cleanInt}.${decPart}` : `${sign}${cleanInt}`;
  }

  function adjustFontSize(element) {
    const textLength = element.textContent.length;
    if (textLength <= 8) element.style.fontSize = '38px';
    else if (textLength <= 14) element.style.fontSize = '28px';
    else if (textLength <= 20) element.style.fontSize = '22px';
    else if (textLength <= 24) element.style.fontSize = '18px';
    else element.style.fontSize = '14px';
  }

  /* ======================================================== */
  /* SIDEBAR NAVIGATION & VIEW SWITCHING                      */
  /* ======================================================== */
  const VIEW_MAP = {
    standard: { title: 'Standard', panelId: 'view-calc', wide: false },
    scientific: { title: 'Scientific', panelId: 'view-calc', wide: false },
    programmer: { title: 'Programmer', panelId: 'view-programmer', wide: false },
    converter: { title: 'Unit Converter', panelId: 'view-converter', wide: false },
    matrix: { title: 'Matrix Calculator', panelId: 'view-matrix', wide: true },
    equations: { title: 'Equation Solver', panelId: 'view-equations', wide: true },
    statistics: { title: 'Statistics', panelId: 'view-statistics', wide: true },
    graph: { title: 'Graph 2D', panelId: 'view-graph', wide: true },
    finance: { title: 'Finance', panelId: 'view-finance', wide: false },
    datetime: { title: 'Date & Time', panelId: 'view-datetime', wide: false },
  };

  function switchView(mode) {
    activeView = mode;
    const viewCfg = VIEW_MAP[mode] || VIEW_MAP.standard;

    // Update Header
    currentModeTitle.textContent = viewCfg.title;

    // Stage width
    stageEl.classList.toggle('wide-mode', Boolean(viewCfg.wide));

    // Hide all view panels
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));

    // Show active panel
    const targetPanel = document.getElementById(viewCfg.panelId);
    if (targetPanel) targetPanel.classList.add('active');

    // Standard / Scientific sub-keypad toggling
    if (mode === 'scientific') {
      keypadStandard.style.display = 'none';
      keypadScientific.style.display = 'grid';
      updateSciDisplay();
    } else if (mode === 'standard') {
      keypadStandard.style.display = 'grid';
      keypadScientific.style.display = 'none';
      updateDisplay();
    } else if (mode === 'programmer') {
      updateProgDisplays();
    } else if (mode === 'converter') {
      recalcConverter();
    } else if (mode === 'matrix') {
      renderMatrixGrid();
    } else if (mode === 'graph') {
      setTimeout(plotGraph, 100);
    }

    // Update sidebar items active state
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.classList.toggle('active', item.dataset.mode === mode);
    });

    closeSidebar();
  }

  function openSidebar() {
    sidebarDrawer.classList.add('open');
    sidebarOverlay.classList.add('open');
  }

  function closeSidebar() {
    sidebarDrawer.classList.remove('open');
    sidebarOverlay.classList.remove('open');
  }

  menuToggle.addEventListener('click', openSidebar);
  sidebarClose.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  document.querySelectorAll('.sidebar-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      switchView(mode);
    });
  });

  /* History Panel events */
  historyToggle.addEventListener('click', () => historyPanel.classList.toggle('open'));
  sidebarHistoryBtn.addEventListener('click', () => {
    closeSidebar();
    historyPanel.classList.add('open');
  });
  historyClose.addEventListener('click', () => historyPanel.classList.remove('open'));
  historyClear.addEventListener('click', () => {
    history = [];
    renderHistory();
  });

  historyList.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-idx]');
    if (!li) return;
    const item = history[Number(li.dataset.idx)];
    if (activeView === 'scientific') {
      sciExpr = item.result;
      updateSciDisplay();
    } else if (activeView === 'standard') {
      current = item.result;
      previous = null;
      operator = null;
      overwrite = true;
      updateDisplay();
    } else if (activeView === 'programmer') {
      try {
        progValue = BigInt(Math.trunc(Number(item.result)));
        updateProgDisplays();
      } catch (err) {}
    }
    historyPanel.classList.remove('open');
  });

  /* Theme and Settings events */
  function applyTheme(isLight) {
    document.body.classList.toggle('light', isLight);
    settingThemeToggle.checked = isLight;
    localStorage.setItem('scicalc_theme', isLight ? 'light' : 'dark');
  }

  themeToggle.addEventListener('click', () => {
    const isLight = !document.body.classList.contains('light');
    applyTheme(isLight);
  });

  settingsToggle.addEventListener('click', () => settingsModal.classList.add('open'));
  sidebarSettingsBtn.addEventListener('click', () => {
    closeSidebar();
    settingsModal.classList.add('open');
  });
  settingsClose.addEventListener('click', () => settingsModal.classList.remove('open'));
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('open');
  });

  settingSoundToggle.addEventListener('change', (e) => {
    soundEnabled = e.target.checked;
    localStorage.setItem('scicalc_sound', soundEnabled);
  });

  settingThemeToggle.addEventListener('change', (e) => {
    applyTheme(e.target.checked);
  });

  settingAngleUnit.addEventListener('change', (e) => {
    angleUnit = e.target.value;
    if (sciAngleUnitBtn) sciAngleUnitBtn.textContent = angleUnit;
  });

  settingPrecision.addEventListener('change', (e) => {
    precision = parseInt(e.target.value, 10) || 10;
  });

  // Load saved preferences
  if (localStorage.getItem('scicalc_theme') === 'light') applyTheme(true);
  if (localStorage.getItem('scicalc_sound') === 'false') {
    soundEnabled = false;
    settingSoundToggle.checked = false;
  }

  copyBtn.addEventListener('click', async () => {
    const text = resultEl.textContent;
    if (!text || text === 'Lỗi') return;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.classList.add('copied');
      setTimeout(() => copyBtn.classList.remove('copied'), 900);
    } catch (err) {}
  });

  /* ======================================================== */
  /* STANDARD MODE LOGIC                                      */
  /* ======================================================== */
  const OP_MAP = { '+': '+', '−': '-', '×': '*', '÷': '/', 'mod': 'mod', '^': '^' };
  let memory = 0;
  let current = '0';
  let previous = null;
  let operator = null;
  let overwrite = true;

  function updateDisplay() {
    resultEl.textContent = formatNumber(current);
    adjustFontSize(resultEl);
    if (operator && previous !== null) {
      const opSym = Object.keys(OP_MAP).find(k => OP_MAP[k] === operator) || operator;
      expressionEl.textContent = `${formatNumber(previous)} ${opSym}`;
    } else {
      expressionEl.textContent = '\u00A0';
    }
    memoryTag.classList.toggle('active', memory !== 0);
  }

  function inputDigit(digit) {
    if (current === 'Lỗi') resetStandard(false);
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
      if (current.replace('-', '').replace('.', '').length >= 14) return;
      current = current === '0' ? digit : current + digit;
    }
    updateDisplay();
  }

  function chooseOperator(opSymbol) {
    if (current === 'Lỗi') return;
    const op = OP_MAP[opSymbol] || opSymbol;
    if (operator && !overwrite) computeStandard();
    previous = current;
    operator = op;
    overwrite = true;
    updateDisplay();
  }

  function computeStandard() {
    if (operator === null || previous === null) return;
    const a = parseFloat(previous);
    const b = parseFloat(current);
    let result;
    switch (operator) {
      case '+': result = a + b; break;
      case '-': result = a - b; break;
      case '*': result = a * b; break;
      case '/':
        if (b === 0) {
          current = 'Lỗi'; previous = null; operator = null; overwrite = true; updateDisplay(); return;
        }
        result = a / b;
        break;
      case 'mod': result = a % b; break;
      case '^': result = Math.pow(a, b); break;
      default: return;
    }
    result = Math.round((result + Number.EPSILON) * 1e10) / 1e10;
    const opSym = Object.keys(OP_MAP).find(k => OP_MAP[k] === operator) || operator;
    const expr = `${formatNumber(previous)} ${opSym} ${formatNumber(current)}`;
    current = String(result);
    pushHistory(expr, current);
    previous = null;
    operator = null;
    overwrite = true;
    updateDisplay();
  }

  function percentStandard() {
    if (current === 'Lỗi') return;
    current = String(parseFloat(current) / 100);
    updateDisplay();
  }

  function deleteLastStandard() {
    if (current === 'Lỗi' || overwrite) { resetStandard(false); return; }
    current = current.length > 1 ? current.slice(0, -1) : '0';
    if (current === '-') current = '0';
    updateDisplay();
  }

  function resetStandard(hard = true) {
    current = '0';
    if (hard) { previous = null; operator = null; }
    overwrite = true;
    updateDisplay();
  }

  function handleStandardClick(btn) {
    const { num, op, action } = btn.dataset;
    if (num !== undefined) return inputDigit(num);
    if (op !== undefined) return chooseOperator(op);
    switch (action) {
      case 'clear': return resetStandard(true);
      case 'delete': return deleteLastStandard();
      case 'percent': return percentStandard();
      case 'equals': return computeStandard();
      case 'mem-clear': memory = 0; return updateDisplay();
      case 'mem-recall': current = String(memory); overwrite = true; return updateDisplay();
      case 'mem-add': memory += parseFloat(current || '0'); return updateDisplay();
      case 'mem-sub': memory -= parseFloat(current || '0'); return updateDisplay();
    }
  }

  /* ======================================================== */
  /* SCIENTIFIC MODE LOGIC (WITH MATH.JS)                     */
  /* ======================================================== */
  let sciExpr = '';

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

  function updateSciDisplay() {
    resultEl.textContent = sciExpr === '' ? '0' : sciExpr;
    adjustFontSize(resultEl);
    const preview = sciExpr === '' ? null : sciEvaluateRaw(sciExpr);
    expressionEl.textContent = preview !== null ? `= ${formatNumber(String(preview))}` : '\u00A0';
    memoryTag.classList.toggle('active', memory !== 0);
  }

  function sciOpenParenCount(str = sciExpr) {
    let count = 0;
    for (const ch of str) {
      if (ch === '(') count++;
      else if (ch === ')') count--;
    }
    return count;
  }

  function sciEvaluateRaw(exprStr) {
    let s = exprStr.trim();
    if (s === '' || s === '-') return null;
    s = s.replace(/ (mod|[+\-×÷^])\s*$/, '').replace(/-$/, '');
    if (s === '') return null;
    const openCount = sciOpenParenCount(s);
    if (openCount > 0) s += ')'.repeat(openCount);
    let evalStr = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');

    try {
      if (typeof math !== 'undefined') {
        const scope = {};
        if (angleUnit === 'DEG') {
          scope.sin = (x) => math.sin((x * Math.PI) / 180);
          scope.cos = (x) => math.cos((x * Math.PI) / 180);
          scope.tan = (x) => math.tan((x * Math.PI) / 180);
        }
        const val = math.evaluate(evalStr, scope);
        if (typeof val !== 'number' || !isFinite(val)) return null;
        return Math.round((val + Number.EPSILON) * 1e10) / 1e10;
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  function sciAppendNumber(token) {
    if (token === '.') {
      const seg = sciExpr.split(/[^0-9.]+/).pop();
      if (seg.includes('.')) return;
      if (seg === '') sciExpr += sciExpr.slice(-1) === ')' ? ' × 0.' : '0.';
      else sciExpr += '.';
      return updateSciDisplay();
    }
    if (sciExpr.slice(-1) === ')') {
      sciExpr += ' × ' + token;
    } else {
      sciExpr += token;
    }
    updateSciDisplay();
  }

  function sciAppendConstant(token) {
    sciExpr += /[0-9)]/.test(sciExpr.slice(-1)) ? ' × ' + token : token;
    updateSciDisplay();
  }

  function sciAppendOpenParen() {
    sciExpr += /[0-9)]/.test(sciExpr.slice(-1)) ? ' × (' : '(';
    updateSciDisplay();
  }

  function sciAppendCloseParen() {
    if (sciOpenParenCount() <= 0) return;
    if (!/[0-9)]/.test(sciExpr.slice(-1))) return;
    sciExpr += ')';
    updateSciDisplay();
  }

  function sciAppendOperator(opSymbol) {
    if (sciExpr === '') {
      if (opSymbol === '−' || opSymbol === '-') { sciExpr = '-'; updateSciDisplay(); }
      return;
    }
    if (sciExpr === '-') return;
    if (sciExpr.slice(-1) === '(') {
      if (opSymbol === '−' || opSymbol === '-') { sciExpr += '-'; updateSciDisplay(); }
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

  function handleSciClick(btn) {
    const { num, op, action, func, kind } = btn.dataset;
    if (action === 'deg-rad') {
      angleUnit = angleUnit === 'DEG' ? 'RAD' : 'DEG';
      sciAngleUnitBtn.textContent = angleUnit;
      settingAngleUnit.value = angleUnit;
      return updateSciDisplay();
    }
    if (func !== undefined) return sciApplyFunc(func);
    if (num !== undefined) return kind === 'const' ? sciAppendConstant(num) : sciAppendNumber(num);
    if (op !== undefined) return sciAppendOperator(op);
    switch (action) {
      case 'clear': sciExpr = ''; return updateSciDisplay();
      case 'delete': return sciBackspace();
      case 'equals': return sciEquals();
      case 'toggle-sign': return sciToggleSign();
      case 'open-paren': return sciAppendOpenParen();
      case 'close-paren': return sciAppendCloseParen();
    }
  }

  /* Keypad Event Listeners */
  [keypadStandard, keypadScientific].forEach(pad => {
    if (!pad) return;
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

  /* ======================================================== */
  /* PROGRAMMER MODE (IMAGE 1 REPLICA)                        */
  /* ======================================================== */
  const progMainValue = document.getElementById('progMainValue');
  const progExpr = document.getElementById('progExpr');
  const valHex = document.getElementById('val-HEX');
  const valDec = document.getElementById('val-DEC');
  const valOct = document.getElementById('val-OCT');
  const valBin = document.getElementById('val-BIN');
  const progWordSizeBtn = document.getElementById('progWordSizeBtn');
  const progBitToggleBtn = document.getElementById('progBitToggleBtn');
  const progKeypadToggle = document.getElementById('progKeypadToggle');
  const progBitPanel = document.getElementById('progBitPanel');
  const bitGrid = document.getElementById('bitGrid');
  const progKeypad = document.getElementById('progKeypad');
  const progCopyBtn = document.getElementById('progCopyBtn');
  const progBitwiseMenuBtn = document.getElementById('progBitwiseMenuBtn');
  const progBitwiseMenu = document.getElementById('progBitwiseMenu');
  const progBitShiftMenuBtn = document.getElementById('progBitShiftMenuBtn');
  const progBitShiftMenu = document.getElementById('progBitShiftMenu');
  const progMsBtn = document.getElementById('progMsBtn');
  const progMrBtn = document.getElementById('progMrBtn');

  let progActiveBase = 'DEC'; // 'HEX' | 'DEC' | 'OCT' | 'BIN'
  let progWordSize = 'QWORD'; // 'BYTE' (8-bit) | 'WORD' (16-bit) | 'DWORD' (32-bit) | 'QWORD' (64-bit)
  let progValue = 0n; // Current typed / calculated 64-bit BigInt
  let progPrev = null; // Previous BigInt
  let progOp = null; // Active programmer operator
  let progOverwrite = true;
  let progMemory = 0n;

  const WORD_SPECS = {
    BYTE: { bits: 8n, mask: 0xFFn, maxSigned: 127n, minSigned: -128n },
    WORD: { bits: 16n, mask: 0xFFFFn, maxSigned: 32767n, minSigned: -32768n },
    DWORD: { bits: 32n, mask: 0xFFFFFFFFn, maxSigned: 2147483647n, minSigned: -2147483648n },
    QWORD: { bits: 64n, mask: 0xFFFFFFFFFFFFFFFFn, maxSigned: 9223372036854775807n, minSigned: -9223372036854775808n },
  };

  function getWordMask() {
    return WORD_SPECS[progWordSize].mask;
  }

  function getWordBits() {
    return WORD_SPECS[progWordSize].bits;
  }

  function applyWordMask(val) {
    const spec = WORD_SPECS[progWordSize];
    return BigInt.asIntN(Number(spec.bits), val);
  }

  function updateProgBaseKeysAvailability() {
    // Enable/disable keys based on active base
    const hexKeys = document.querySelectorAll('.key-hex');
    const numKeys = document.querySelectorAll('#progKeypad .key-num');

    if (progActiveBase === 'HEX') {
      hexKeys.forEach(k => k.disabled = false);
      numKeys.forEach(k => k.disabled = false);
    } else if (progActiveBase === 'DEC') {
      hexKeys.forEach(k => k.disabled = true);
      numKeys.forEach(k => k.disabled = false);
    } else if (progActiveBase === 'OCT') {
      hexKeys.forEach(k => k.disabled = true);
      numKeys.forEach(k => {
        const val = k.dataset.progKey;
        k.disabled = (val === '8' || val === '9');
      });
    } else if (progActiveBase === 'BIN') {
      hexKeys.forEach(k => k.disabled = true);
      numKeys.forEach(k => {
        const val = k.dataset.progKey;
        k.disabled = (val !== '0' && val !== '1');
      });
    }
  }

  function formatBinaryWithSpaces(binStr, bits) {
    const padded = binStr.padStart(Number(bits), '0');
    // Group in chunks of 4 bits
    return padded.match(/.{1,4}/g).join(' ');
  }

  function updateProgDisplays() {
    const mask = getWordMask();
    const bits = getWordBits();
    const unsignedVal = BigInt.asUintN(Number(bits), progValue);

    // HEX
    valHex.textContent = unsignedVal.toString(16).toUpperCase();

    // DEC (Signed)
    valDec.textContent = progValue.toString(10);

    // OCT
    valOct.textContent = unsignedVal.toString(8);

    // BIN
    const rawBin = unsignedVal.toString(2);
    valBin.textContent = formatBinaryWithSpaces(rawBin, bits);

    // Main Display shows value in active base
    let mainStr = '0';
    if (progActiveBase === 'HEX') mainStr = unsignedVal.toString(16).toUpperCase();
    else if (progActiveBase === 'DEC') mainStr = progValue.toString(10);
    else if (progActiveBase === 'OCT') mainStr = unsignedVal.toString(8);
    else if (progActiveBase === 'BIN') mainStr = rawBin;

    progMainValue.textContent = mainStr;
    adjustFontSize(progMainValue);

    // Expression preview
    if (progOp && progPrev !== null) {
      progExpr.textContent = `${progPrev.toString(10)} ${progOp}`;
    } else {
      progExpr.textContent = '\u00A0';
    }

    renderBitGrid();
    updateProgBaseKeysAvailability();
  }

  function renderBitGrid() {
    const bits = Number(getWordBits());
    const unsignedVal = BigInt.asUintN(bits, progValue);
    bitGrid.innerHTML = '';
    bitGrid.style.gridTemplateColumns = bits === 64 ? 'repeat(16, 1fr)' : 'repeat(8, 1fr)';

    for (let i = bits - 1; i >= 0; i--) {
      const bitVal = (unsignedVal >> BigInt(i)) & 1n;
      const cell = document.createElement('div');
      cell.className = `bit-cell ${bitVal === 1n ? 'one' : ''}`;
      cell.textContent = bitVal.toString();
      cell.title = `Bit ${i}`;
      cell.addEventListener('click', () => {
        // Toggle bit
        const toggled = unsignedVal ^ (1n << BigInt(i));
        progValue = applyWordMask(toggled);
        updateProgDisplays();
      });
      bitGrid.appendChild(cell);
    }
  }

  // Base switcher
  document.querySelectorAll('.prog-base-row').forEach(row => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.prog-base-row').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      progActiveBase = row.dataset.base;
      updateProgDisplays();
    });
  });

  // Word Size toggle button
  progWordSizeBtn.addEventListener('click', () => {
    const sizes = ['QWORD', 'DWORD', 'WORD', 'BYTE'];
    let idx = sizes.indexOf(progWordSize);
    progWordSize = sizes[(idx + 1) % sizes.length];
    progWordSizeBtn.textContent = progWordSize;
    progValue = applyWordMask(progValue);
    updateProgDisplays();
  });

  // Bit toggle panel toggle
  progBitToggleBtn.addEventListener('click', () => {
    const isOpen = progBitPanel.style.display !== 'none';
    progBitPanel.style.display = isOpen ? 'none' : 'block';
    progBitToggleBtn.classList.toggle('active', !isOpen);
  });

  progKeypadToggle.addEventListener('click', () => {
    progBitPanel.style.display = 'none';
    progBitToggleBtn.classList.remove('active');
  });

  // Bitwise dropdown
  progBitwiseMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    progBitwiseMenu.classList.toggle('show');
    progBitShiftMenu.classList.remove('show');
  });

  progBitShiftMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    progBitShiftMenu.classList.toggle('show');
    progBitwiseMenu.classList.remove('show');
  });

  document.addEventListener('click', () => {
    progBitwiseMenu.classList.remove('show');
    progBitShiftMenu.classList.remove('show');
  });

  function progInputDigit(digit) {
    const radix = progActiveBase === 'HEX' ? 16 : progActiveBase === 'DEC' ? 10 : progActiveBase === 'OCT' ? 8 : 2;
    if (progOverwrite) {
      progValue = BigInt(parseInt(digit, radix));
      progOverwrite = false;
    } else {
      const bits = getWordBits();
      const unsignedVal = BigInt.asUintN(Number(bits), progValue);
      const str = unsignedVal.toString(radix) + digit;
      try {
        const nextVal = BigInt(parseInt(str, radix));
        progValue = applyWordMask(nextVal);
      } catch (e) {}
    }
    updateProgDisplays();
  }

  function progSetOperator(op) {
    if (progOp && !progOverwrite) progCompute();
    progPrev = progValue;
    progOp = op;
    progOverwrite = true;
    updateProgDisplays();
  }

  function progCompute() {
    if (progOp === null || progPrev === null) return;
    const a = progPrev;
    const b = progValue;
    let res = 0n;

    switch (progOp) {
      case '+': res = a + b; break;
      case '−':
      case '-': res = a - b; break;
      case '×':
      case '*': res = a * b; break;
      case '÷':
      case '/':
        if (b === 0n) {
          progMainValue.textContent = 'Lỗi chia cho 0';
          progPrev = null;
          progOp = null;
          progOverwrite = true;
          return;
        }
        res = a / b;
        break;
      case 'MOD':
      case '%':
        if (b === 0n) return;
        res = a % b;
        break;
      case 'AND': res = a & b; break;
      case 'OR': res = a | b; break;
      case 'XOR': res = a ^ b; break;
      case 'NAND': res = ~(a & b); break;
      case 'NOR': res = ~(a | b); break;
      case 'LSH': res = a << b; break;
      case 'RSH': {
        const bits = getWordBits();
        const unsignedA = BigInt.asUintN(Number(bits), a);
        res = unsignedA >> b;
        break;
      }
      case 'ROL': {
        const bits = getWordBits();
        const shift = b % bits;
        const unsignedA = BigInt.asUintN(Number(bits), a);
        res = (unsignedA << shift) | (unsignedA >> (bits - shift));
        break;
      }
      case 'ROR': {
        const bits = getWordBits();
        const shift = b % bits;
        const unsignedA = BigInt.asUintN(Number(bits), a);
        res = (unsignedA >> shift) | (unsignedA << (bits - shift));
        break;
      }
    }

    res = applyWordMask(res);
    pushHistory(`${a.toString(10)} ${progOp} ${b.toString(10)}`, res.toString(10));
    progValue = res;
    progPrev = null;
    progOp = null;
    progOverwrite = true;
    updateProgDisplays();
  }

  // Keypad clicks in Programmer mode
  progKeypad.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.key');
    if (btn) createRipple(e, btn);
  });

  progKeypad.addEventListener('click', (e) => {
    const btn = e.target.closest('.key');
    if (!btn || btn.disabled) return;

    if (btn.dataset.progKey !== undefined) {
      return progInputDigit(btn.dataset.progKey);
    }
    if (btn.dataset.progOp !== undefined) {
      return progSetOperator(btn.dataset.progOp);
    }
    if (btn.dataset.progShift !== undefined) {
      return progSetOperator(btn.dataset.progShift);
    }
    const action = btn.dataset.progAction;
    if (action === 'clear') {
      progValue = 0n;
      progPrev = null;
      progOp = null;
      progOverwrite = true;
      return updateProgDisplays();
    }
    if (action === 'delete') {
      const radix = progActiveBase === 'HEX' ? 16 : progActiveBase === 'DEC' ? 10 : progActiveBase === 'OCT' ? 8 : 2;
      const bits = getWordBits();
      const unsignedVal = BigInt.asUintN(Number(bits), progValue);
      let s = unsignedVal.toString(radix);
      s = s.length > 1 ? s.slice(0, -1) : '0';
      progValue = applyWordMask(BigInt(parseInt(s, radix) || 0));
      return updateProgDisplays();
    }
    if (action === 'toggle-sign') {
      progValue = applyWordMask(-progValue);
      return updateProgDisplays();
    }
    if (action === 'equals') {
      return progCompute();
    }
  });

  // Dropdown items click
  document.querySelectorAll('[data-prog-op]').forEach(item => {
    item.addEventListener('click', () => {
      const op = item.dataset.progOp;
      if (op === 'NOT') {
        progValue = applyWordMask(~progValue);
        updateProgDisplays();
      } else {
        progSetOperator(op);
      }
    });
  });

  document.querySelectorAll('[data-prog-shift]').forEach(item => {
    item.addEventListener('click', () => {
      const shift = item.dataset.progShift;
      progSetOperator(shift);
    });
  });

  // Memory buttons in Programmer
  progMsBtn.addEventListener('click', () => {
    progMemory = progValue;
    progMsBtn.style.color = 'var(--amber)';
  });
  progMrBtn.addEventListener('click', () => {
    progValue = progMemory;
    progOverwrite = true;
    updateProgDisplays();
  });

  progCopyBtn.addEventListener('click', async () => {
    const text = progMainValue.textContent;
    try {
      await navigator.clipboard.writeText(text);
      progCopyBtn.classList.add('copied');
      setTimeout(() => progCopyBtn.classList.remove('copied'), 900);
    } catch (e) {}
  });

  /* ======================================================== */
  /* UNIT CONVERTER (IMAGE 2 REPLICA)                         */
  /* ======================================================== */
  const convCategorySelect = document.getElementById('convCategorySelect');
  const convTopBlock = document.getElementById('convTopBlock');
  const convBottomBlock = document.getElementById('convBottomBlock');
  const convTopVal = document.getElementById('convTopVal');
  const convBottomVal = document.getElementById('convBottomVal');
  const convTopUnitSelect = document.getElementById('convTopUnitSelect');
  const convBottomUnitSelect = document.getElementById('convBottomUnitSelect');
  const convSwapBtn = document.getElementById('convSwapBtn');
  const convFormulaText = document.getElementById('convFormulaText');
  const convKeypad = document.getElementById('convKeypad');

  let activeConvBlock = 'top'; // 'top' | 'bottom'
  let convTopNumber = '0';
  let convBottomNumber = '0';

  // 7 Categories definitions
  const CONVERSION_DATA = {
    volume: {
      units: [
        { id: 'ml', name: 'Milliliters (mL)', toBase: 0.001 },
        { id: 'l', name: 'Liters (L)', toBase: 1 },
        { id: 'm3', name: 'Cubic meters (m³)', toBase: 1000 },
        { id: 'tsp', name: 'Teaspoons (US)', toBase: 0.00492892 },
        { id: 'tbsp', name: 'Tablespoons (US)', toBase: 0.0147868 },
        { id: 'floz', name: 'Fluid Ounces (US)', toBase: 0.0295735 },
        { id: 'cup', name: 'Cups (US)', toBase: 0.236588 },
        { id: 'pint', name: 'Pints (US)', toBase: 0.473176 },
        { id: 'gal', name: 'Gallons (US)', toBase: 3.78541 },
      ],
      defaultTop: 'ml',
      defaultBottom: 'tsp',
    },
    length: {
      units: [
        { id: 'm', name: 'Meters (m)', toBase: 1 },
        { id: 'km', name: 'Kilometers (km)', toBase: 1000 },
        { id: 'cm', name: 'Centimeters (cm)', toBase: 0.01 },
        { id: 'mm', name: 'Millimeters (mm)', toBase: 0.001 },
        { id: 'mi', name: 'Miles (mi)', toBase: 1609.344 },
        { id: 'yd', name: 'Yards (yd)', toBase: 0.9144 },
        { id: 'ft', name: 'Feet (ft)', toBase: 0.3048 },
        { id: 'in', name: 'Inches (in)', toBase: 0.0254 },
        { id: 'nmi', name: 'Nautical Miles', toBase: 1852 },
      ],
      defaultTop: 'm',
      defaultBottom: 'ft',
    },
    weight: {
      units: [
        { id: 'kg', name: 'Kilograms (kg)', toBase: 1 },
        { id: 'g', name: 'Grams (g)', toBase: 0.001 },
        { id: 'mg', name: 'Milligrams (mg)', toBase: 1e-6 },
        { id: 'ton', name: 'Metric Tons (t)', toBase: 1000 },
        { id: 'lb', name: 'Pounds (lb)', toBase: 0.45359237 },
        { id: 'oz', name: 'Ounces (oz)', toBase: 0.028349523 },
        { id: 'carat', name: 'Carats (ct)', toBase: 0.0002 },
        { id: 'stone', name: 'Stones (st)', toBase: 6.35029 },
      ],
      defaultTop: 'kg',
      defaultBottom: 'lb',
    },
    temperature: {
      units: [
        { id: 'c', name: 'Celsius (°C)' },
        { id: 'f', name: 'Fahrenheit (°F)' },
        { id: 'k', name: 'Kelvin (K)' },
      ],
      defaultTop: 'c',
      defaultBottom: 'f',
      special: true,
    },
    area: {
      units: [
        { id: 'm2', name: 'Square Meters (m²)', toBase: 1 },
        { id: 'km2', name: 'Square Kilometers (km²)', toBase: 1e6 },
        { id: 'cm2', name: 'Square Centimeters (cm²)', toBase: 0.0001 },
        { id: 'ha', name: 'Hectares (ha)', toBase: 10000 },
        { id: 'acre', name: 'Acres (ac)', toBase: 4046.856 },
        { id: 'ft2', name: 'Square Feet (ft²)', toBase: 0.092903 },
        { id: 'in2', name: 'Square Inches (in²)', toBase: 0.00064516 },
      ],
      defaultTop: 'm2',
      defaultBottom: 'acre',
    },
    speed: {
      units: [
        { id: 'kmh', name: 'Kilometers/hour (km/h)', toBase: 1 / 3.6 },
        { id: 'ms', name: 'Meters/second (m/s)', toBase: 1 },
        { id: 'mph', name: 'Miles/hour (mph)', toBase: 0.44704 },
        { id: 'knot', name: 'Knots (kn)', toBase: 0.514444 },
        { id: 'mach', name: 'Mach (at sea level)', toBase: 340.29 },
      ],
      defaultTop: 'kmh',
      defaultBottom: 'mph',
    },
    time: {
      units: [
        { id: 's', name: 'Seconds (s)', toBase: 1 },
        { id: 'ms', name: 'Milliseconds (ms)', toBase: 0.001 },
        { id: 'min', name: 'Minutes (min)', toBase: 60 },
        { id: 'h', name: 'Hours (h)', toBase: 3600 },
        { id: 'd', name: 'Days (d)', toBase: 86400 },
        { id: 'wk', name: 'Weeks (wk)', toBase: 604800 },
        { id: 'mo', name: 'Months (30 days)', toBase: 2592000 },
        { id: 'yr', name: 'Years (365 days)', toBase: 31536000 },
      ],
      defaultTop: 'h',
      defaultBottom: 'min',
    },
  };

  function populateConverterUnits() {
    const cat = convCategorySelect.value;
    const catData = CONVERSION_DATA[cat];
    if (!catData) return;

    convTopUnitSelect.innerHTML = catData.units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    convBottomUnitSelect.innerHTML = catData.units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');

    convTopUnitSelect.value = catData.defaultTop;
    convBottomUnitSelect.value = catData.defaultBottom;
  }

  function convertTemp(val, fromUnit, toUnit) {
    let c = val;
    if (fromUnit === 'f') c = (val - 32) * (5 / 9);
    else if (fromUnit === 'k') c = val - 273.15;

    let res = c;
    if (toUnit === 'f') res = c * (9 / 5) + 32;
    else if (toUnit === 'k') res = c + 273.15;
    return res;
  }

  function formatConverted(val) {
    if (isNaN(val) || !isFinite(val)) return '0';
    if (Math.abs(val) < 1e-7 && val !== 0) return val.toExponential(4);
    return String(Math.round(val * 1e8) / 1e8);
  }

  function recalcConverter() {
    const cat = convCategorySelect.value;
    const catData = CONVERSION_DATA[cat];
    const topUnitId = convTopUnitSelect.value;
    const bottomUnitId = convBottomUnitSelect.value;

    if (catData.special) {
      // Temperature
      if (activeConvBlock === 'top') {
        const val = parseFloat(convTopNumber) || 0;
        const res = convertTemp(val, topUnitId, bottomUnitId);
        convBottomNumber = formatConverted(res);
      } else {
        const val = parseFloat(convBottomNumber) || 0;
        const res = convertTemp(val, bottomUnitId, topUnitId);
        convTopNumber = formatConverted(res);
      }
      convFormulaText.textContent = `1 ${topUnitId.toUpperCase()} = ${formatConverted(convertTemp(1, topUnitId, bottomUnitId))} ${bottomUnitId.toUpperCase()}`;
    } else {
      const uTop = catData.units.find(u => u.id === topUnitId);
      const uBottom = catData.units.find(u => u.id === bottomUnitId);

      if (uTop && uBottom) {
        if (activeConvBlock === 'top') {
          const val = parseFloat(convTopNumber) || 0;
          const baseVal = val * uTop.toBase;
          const converted = baseVal / uBottom.toBase;
          convBottomNumber = formatConverted(converted);
        } else {
          const val = parseFloat(convBottomNumber) || 0;
          const baseVal = val * uBottom.toBase;
          const converted = baseVal / uTop.toBase;
          convTopNumber = formatConverted(converted);
        }

        const oneConv = (1 * uTop.toBase) / uBottom.toBase;
        convFormulaText.textContent = `1 ${uTop.name.split(' ')[0]} = ${formatConverted(oneConv)} ${uBottom.name.split(' ')[0]}`;
      }
    }

    convTopVal.textContent = convTopNumber;
    convBottomVal.textContent = convBottomNumber;
    adjustFontSize(convTopVal);
    adjustFontSize(convBottomVal);
  }

  convCategorySelect.addEventListener('change', () => {
    populateConverterUnits();
    convTopNumber = '0';
    convBottomNumber = '0';
    recalcConverter();
  });

  convTopUnitSelect.addEventListener('change', recalcConverter);
  convBottomUnitSelect.addEventListener('change', recalcConverter);

  convTopBlock.addEventListener('click', () => {
    activeConvBlock = 'top';
    convTopBlock.classList.add('active');
    convBottomBlock.classList.remove('active');
  });

  convBottomBlock.addEventListener('click', () => {
    activeConvBlock = 'bottom';
    convBottomBlock.classList.add('active');
    convTopBlock.classList.remove('active');
  });

  convSwapBtn.addEventListener('click', () => {
    const temp = convTopUnitSelect.value;
    convTopUnitSelect.value = convBottomUnitSelect.value;
    convBottomUnitSelect.value = temp;
    recalcConverter();
  });

  function convInputDigit(digit) {
    let target = activeConvBlock === 'top' ? convTopNumber : convBottomNumber;
    if (digit === '.') {
      if (target.includes('.')) return;
      target += '.';
    } else {
      if (target === '0') target = digit;
      else if (target.length < 15) target += digit;
    }

    if (activeConvBlock === 'top') convTopNumber = target;
    else convBottomNumber = target;
    recalcConverter();
  }

  function convClearEntry() {
    if (activeConvBlock === 'top') convTopNumber = '0';
    else convBottomNumber = '0';
    recalcConverter();
  }

  function convBackspace() {
    let target = activeConvBlock === 'top' ? convTopNumber : convBottomNumber;
    target = target.length > 1 ? target.slice(0, -1) : '0';
    if (target === '-') target = '0';
    if (activeConvBlock === 'top') convTopNumber = target;
    else convBottomNumber = target;
    recalcConverter();
  }

  function convToggleSign() {
    let target = activeConvBlock === 'top' ? convTopNumber : convBottomNumber;
    if (target === '0') return;
    target = target.startsWith('-') ? target.slice(1) : '-' + target;
    if (activeConvBlock === 'top') convTopNumber = target;
    else convBottomNumber = target;
    recalcConverter();
  }

  convKeypad.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.key');
    if (btn) createRipple(e, btn);
  });

  convKeypad.addEventListener('click', (e) => {
    const btn = e.target.closest('.key');
    if (!btn) return;
    if (btn.dataset.convNum !== undefined) return convInputDigit(btn.dataset.convNum);
    const action = btn.dataset.convAction;
    if (action === 'clear-entry') return convClearEntry();
    if (action === 'delete') return convBackspace();
    if (action === 'toggle-sign') return convToggleSign();
  });

  populateConverterUnits();

  /* ======================================================== */
  /* MATRIX CALCULATOR                                        */
  /* ======================================================== */
  const matrixTabs = document.querySelectorAll('.matrix-tab-btn');
  const matrixCurrentLabel = document.getElementById('matrixCurrentLabel');
  const matrixRowsSelect = document.getElementById('matrixRowsSelect');
  const matrixColsSelect = document.getElementById('matrixColsSelect');
  const matrixGrid = document.getElementById('matrixGrid');
  const matrixResultTitle = document.getElementById('matrixResultTitle');
  const matrixResultBody = document.getElementById('matrixResultBody');
  const matrixUseAsABtn = document.getElementById('matrixUseAsABtn');
  const matrixUseAsBBtn = document.getElementById('matrixUseAsBBtn');
  const matrixCopyResultBtn = document.getElementById('matrixCopyResultBtn');
  const matrixIdentityBtn = document.getElementById('matrixIdentityBtn');
  const matrixRandomBtn = document.getElementById('matrixRandomBtn');
  const matrixClearBtn = document.getElementById('matrixClearBtn');

  let activeMatrixTab = 'A'; // 'A' | 'B' | 'RESULT'
  let matrixA = [[1, 2, 0], [0, 1, -1], [3, 1, 2]];
  let matrixB = [[1, 0, 1], [2, -1, 3], [0, 2, 1]];
  let matrixResult = null; // Can be a 2D array or a scalar number

  function getActiveMatrix() {
    return activeMatrixTab === 'B' ? matrixB : matrixA;
  }

  function setActiveMatrix(newM) {
    if (activeMatrixTab === 'B') matrixB = newM;
    else matrixA = newM;
  }

  function renderMatrixGrid() {
    if (activeMatrixTab === 'RESULT') {
      matrixCurrentLabel.textContent = 'Kết quả (R):';
      matrixGrid.innerHTML = '';
      if (!matrixResult) {
        matrixGrid.innerHTML = '<span style="color:var(--text-muted); font-size:13px;">Chưa có kết quả</span>';
        return;
      }
      if (Array.isArray(matrixResult)) {
        renderArrayIntoGrid(matrixResult, true);
      } else {
        matrixGrid.innerHTML = `<span class="matrix-scalar-res">${matrixResult}</span>`;
      }
      return;
    }

    const currentM = getActiveMatrix();
    const rows = currentM.length;
    const cols = currentM[0].length;

    matrixCurrentLabel.textContent = `Ma trận ${activeMatrixTab}:`;
    matrixRowsSelect.value = String(rows);
    matrixColsSelect.value = String(cols);

    renderArrayIntoGrid(currentM, false);
  }

  function renderArrayIntoGrid(data, isReadonly) {
    const rows = data.length;
    const cols = data[0].length;

    matrixGrid.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    matrixGrid.innerHTML = '';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const input = document.createElement('input');
        input.type = 'number';
        input.step = 'any';
        input.className = 'matrix-cell-input';
        input.value = data[r][c] !== undefined ? data[r][c] : 0;
        input.dataset.row = r;
        input.dataset.col = c;
        if (isReadonly) input.readOnly = true;

        input.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value) || 0;
          const currentM = getActiveMatrix();
          currentM[r][c] = val;
        });

        matrixGrid.appendChild(input);
      }
    }
  }

  function resizeCurrentMatrix(newRows, newCols) {
    const currentM = getActiveMatrix();
    const newM = [];
    for (let r = 0; r < newRows; r++) {
      const row = [];
      for (let c = 0; c < newCols; c++) {
        if (currentM[r] && currentM[r][c] !== undefined) {
          row.push(currentM[r][c]);
        } else {
          row.push(r === c ? 1 : 0);
        }
      }
      newM.push(row);
    }
    setActiveMatrix(newM);
    renderMatrixGrid();
  }

  matrixRowsSelect.addEventListener('change', () => {
    resizeCurrentMatrix(parseInt(matrixRowsSelect.value), parseInt(matrixColsSelect.value));
  });

  matrixColsSelect.addEventListener('change', () => {
    resizeCurrentMatrix(parseInt(matrixRowsSelect.value), parseInt(matrixColsSelect.value));
  });

  // Presets
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [r, c] = btn.dataset.preset.split('x').map(Number);
      resizeCurrentMatrix(r, c);
    });
  });

  matrixIdentityBtn.addEventListener('click', () => {
    const m = getActiveMatrix();
    const rows = m.length;
    const cols = m[0].length;
    const newM = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => (r === c ? 1 : 0))
    );
    setActiveMatrix(newM);
    renderMatrixGrid();
  });

  matrixRandomBtn.addEventListener('click', () => {
    const m = getActiveMatrix();
    const rows = m.length;
    const cols = m[0].length;
    const newM = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Math.floor(Math.random() * 11) - 3)
    );
    setActiveMatrix(newM);
    renderMatrixGrid();
  });

  matrixClearBtn.addEventListener('click', () => {
    const m = getActiveMatrix();
    const rows = m.length;
    const cols = m[0].length;
    const newM = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
    setActiveMatrix(newM);
    renderMatrixGrid();
  });

  // Tab switching
  matrixTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      matrixTabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeMatrixTab = btn.dataset.matrixTab;
      renderMatrixGrid();
    });
  });

  // Gaussian Elimination for Rank
  function computeMatrixRank(matrix) {
    const m = matrix.map(row => [...row]);
    const rows = m.length;
    const cols = m[0].length;
    let rank = 0;
    let row = 0;
    const EPS = 1e-10;

    for (let col = 0; col < cols && row < rows; col++) {
      let maxRow = row;
      for (let i = row + 1; i < rows; i++) {
        if (Math.abs(m[i][col]) > Math.abs(m[maxRow][col])) maxRow = i;
      }
      if (Math.abs(m[maxRow][col]) < EPS) continue;
      [m[row], m[maxRow]] = [m[maxRow], m[row]];
      for (let i = 0; i < rows; i++) {
        if (i !== row) {
          const factor = m[i][col] / m[row][col];
          for (let j = col; j < cols; j++) {
            m[i][j] -= factor * m[row][j];
          }
        }
      }
      row++;
      rank++;
    }
    return rank;
  }

  function displayMatrixResult(title, result, isScalar = false) {
    matrixResultTitle.textContent = title;
    matrixResult = result;

    if (isScalar) {
      matrixResultBody.innerHTML = `<div class="matrix-scalar-res">${result}</div>`;
    } else {
      let html = '<table class="matrix-result-table">';
      for (let r = 0; r < result.length; r++) {
        html += '<tr>';
        for (let c = 0; c < result[r].length; c++) {
          const val = typeof result[r][c] === 'number' ? Math.round((result[r][c] + Number.EPSILON) * 1e6) / 1e6 : result[r][c];
          html += `<td>${val}</td>`;
        }
        html += '</tr>';
      }
      html += '</table>';
      matrixResultBody.innerHTML = html;
    }

    pushHistory(title, isScalar ? String(result) : `[Ma trận ${result.length}×${result[0].length}]`);
  }

  // Dual matrix operations: A + B, A - B, A * B
  document.querySelectorAll('[data-matrix-op]').forEach(btn => {
    btn.addEventListener('click', () => {
      const op = btn.dataset.matrixOp;
      try {
        if (op === 'add') {
          if (matrixA.length !== matrixB.length || matrixA[0].length !== matrixB[0].length) {
            return displayMatrixResult('Lỗi cộng:', 'Hai ma trận phải có cùng kích thước (m × n)!', true);
          }
          const res = math.add(matrixA, matrixB);
          displayMatrixResult('Kết quả: A + B', res);
        } else if (op === 'subtract') {
          if (matrixA.length !== matrixB.length || matrixA[0].length !== matrixB[0].length) {
            return displayMatrixResult('Lỗi trừ:', 'Hai ma trận phải có cùng kích thước (m × n)!', true);
          }
          const res = math.subtract(matrixA, matrixB);
          displayMatrixResult('Kết quả: A − B', res);
        } else if (op === 'multiply') {
          if (matrixA[0].length !== matrixB.length) {
            return displayMatrixResult('Lỗi nhân:', `Số cột của A (${matrixA[0].length}) phải bằng số dòng của B (${matrixB.length})!`, true);
          }
          const res = math.multiply(matrixA, matrixB);
          displayMatrixResult('Kết quả: A × B', res);
        }
      } catch (err) {
        displayMatrixResult('Lỗi phép toán:', err.message || 'Không thể thực hiện', true);
      }
    });
  });

  // Single matrix operations: det, inv, transpose, rank, eigenvalues, trace
  document.querySelectorAll('[data-matrix-single]').forEach(btn => {
    btn.addEventListener('click', () => {
      const op = btn.dataset.matrixSingle;
      const target = matrixA; // Single matrix operations performed on A

      try {
        if (op === 'det') {
          if (target.length !== target[0].length) {
            return displayMatrixResult('Lỗi định thức det(A):', 'Ma trận phải là ma trận vuông (n × n)!', true);
          }
          const d = math.det(target);
          const rounded = Math.round((d + Number.EPSILON) * 1e8) / 1e8;
          displayMatrixResult('det(A)', `det(A) = ${rounded}`, true);
        } else if (op === 'inv') {
          if (target.length !== target[0].length) {
            return displayMatrixResult('Lỗi nghịch đảo A⁻¹:', 'Ma trận phải là ma trận vuông (n × n)!', true);
          }
          const d = math.det(target);
          if (Math.abs(d) < 1e-10) {
            return displayMatrixResult('det(A) = 0', 'Ma trận suy biến (Singular matrix), không có ma trận nghịch đảo!', true);
          }
          const invM = math.inv(target);
          displayMatrixResult('A⁻¹ (Ma trận nghịch đảo)', invM);
        } else if (op === 'transpose') {
          const trans = math.transpose(target);
          displayMatrixResult('Aᵀ (Ma trận chuyển vị)', trans);
        } else if (op === 'rank') {
          const r = computeMatrixRank(target);
          displayMatrixResult('Hạng rank(A)', `rank(A) = ${r}`, true);
        } else if (op === 'eigenvalues') {
          if (target.length !== target[0].length) {
            return displayMatrixResult('Lỗi trị riêng λ:', 'Chỉ tính được trị riêng trên ma trận vuông (n × n)!', true);
          }
          try {
            const eig = math.eigs(target);
            let vals = eig.values;
            if (Array.isArray(vals)) {
              const formatted = vals.map(v => typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v.toString());
              displayMatrixResult('Trị riêng (Eigenvalues λ)', `λ = { ${formatted.join(', ')} }`, true);
            } else {
              displayMatrixResult('Trị riêng (Eigenvalues λ)', `λ = ${vals.toString()}`, true);
            }
          } catch (e) {
            displayMatrixResult('Trị riêng:', 'Không tìm được nghiệm thực hoặc trị riêng phức', true);
          }
        } else if (op === 'trace') {
          if (target.length !== target[0].length) {
            return displayMatrixResult('Lỗi Trace(A):', 'Ma trận phải là ma trận vuông!', true);
          }
          let tr = 0;
          for (let i = 0; i < target.length; i++) tr += target[i][i];
          displayMatrixResult('Trace(A) (Vết ma trận)', `Trace(A) = ${tr}`, true);
        }
      } catch (err) {
        displayMatrixResult('Lỗi:', err.message, true);
      }
    });
  });

  // Action buttons for Matrix Result
  matrixUseAsABtn.addEventListener('click', () => {
    if (matrixResult && Array.isArray(matrixResult)) {
      matrixA = matrixResult.map(row => [...row]);
      activeMatrixTab = 'A';
      matrixTabs.forEach(t => t.classList.toggle('active', t.dataset.matrixTab === 'A'));
      renderMatrixGrid();
    }
  });

  matrixUseAsBBtn.addEventListener('click', () => {
    if (matrixResult && Array.isArray(matrixResult)) {
      matrixB = matrixResult.map(row => [...row]);
      activeMatrixTab = 'B';
      matrixTabs.forEach(t => t.classList.toggle('active', t.dataset.matrixTab === 'B'));
      renderMatrixGrid();
    }
  });

  matrixCopyResultBtn.addEventListener('click', async () => {
    if (!matrixResult) return;
    let text = '';
    if (Array.isArray(matrixResult)) {
      text = matrixResult.map(r => r.join('\t')).join('\n');
    } else {
      text = String(matrixResult);
    }
    try {
      await navigator.clipboard.writeText(text);
      matrixCopyResultBtn.textContent = 'Đã chép!';
      setTimeout(() => matrixCopyResultBtn.textContent = 'Sao chép', 1000);
    } catch (e) {}
  });

  /* ======================================================== */
  /* EQUATION SOLVER (ROADMAP PHASE 1)                        */
  /* ======================================================== */
  const eqBody = document.getElementById('eqBody');
  const eqResultContent = document.getElementById('eqResultContent');
  let currentEqType = 'linear';

  function renderEquationForm() {
    if (currentEqType === 'linear') {
      eqBody.innerHTML = `
        <div class="eq-row">
          <input type="number" class="eq-input" id="eqA" value="2">
          <span>x +</span>
          <input type="number" class="eq-input" id="eqB" value="-4">
          <span>= 0</span>
        </div>
        <button class="key key-equals" id="solveEqBtn" style="width: 100%; margin-top: 10px;">Giải phương trình</button>
      `;
    } else if (currentEqType === 'quadratic') {
      eqBody.innerHTML = `
        <div class="eq-row">
          <input type="number" class="eq-input" id="eqA" value="1">
          <span>x² +</span>
          <input type="number" class="eq-input" id="eqB" value="-5">
          <span>x +</span>
          <input type="number" class="eq-input" id="eqC" value="6">
          <span>= 0</span>
        </div>
        <button class="key key-equals" id="solveEqBtn" style="width: 100%; margin-top: 10px;">Giải phương trình</button>
      `;
    } else if (currentEqType === 'system2') {
      eqBody.innerHTML = `
        <div class="eq-row">
          <input type="number" class="eq-input" id="sysA1" value="2"><span>x +</span>
          <input type="number" class="eq-input" id="sysB1" value="3"><span>y =</span>
          <input type="number" class="eq-input" id="sysC1" value="12">
        </div>
        <div class="eq-row">
          <input type="number" class="eq-input" id="sysA2" value="1"><span>x −</span>
          <input type="number" class="eq-input" id="sysB2" value="1"><span>y =</span>
          <input type="number" class="eq-input" id="sysC2" value="1">
        </div>
        <button class="key key-equals" id="solveEqBtn" style="width: 100%; margin-top: 10px;">Giải hệ phương trình</button>
      `;
    }

    document.getElementById('solveEqBtn').addEventListener('click', solveCurrentEquation);
  }

  function solveCurrentEquation() {
    if (currentEqType === 'linear') {
      const a = parseFloat(document.getElementById('eqA').value) || 0;
      const b = parseFloat(document.getElementById('eqB').value) || 0;
      if (a === 0) {
        eqResultContent.textContent = b === 0 ? 'Phương trình vô số nghiệm (0 = 0)' : 'Phương trình vô nghiệm';
      } else {
        const x = -b / a;
        eqResultContent.innerHTML = `x = <b>${Math.round(x * 1e8) / 1e8}</b>`;
      }
    } else if (currentEqType === 'quadratic') {
      const a = parseFloat(document.getElementById('eqA').value) || 0;
      const b = parseFloat(document.getElementById('eqB').value) || 0;
      const c = parseFloat(document.getElementById('eqC').value) || 0;
      if (a === 0) {
        eqResultContent.textContent = 'Hệ số a = 0 (phương trình trở thành bậc 1)';
        return;
      }
      const delta = b * b - 4 * a * c;
      if (delta > 0) {
        const x1 = (-b + Math.sqrt(delta)) / (2 * a);
        const x2 = (-b - Math.sqrt(delta)) / (2 * a);
        eqResultContent.innerHTML = `Δ = ${delta} &gt; 0<br>x₁ = <b>${Math.round(x1 * 1e6) / 1e6}</b><br>x₂ = <b>${Math.round(x2 * 1e6) / 1e6}</b>`;
      } else if (delta === 0) {
        const x = -b / (2 * a);
        eqResultContent.innerHTML = `Δ = 0 (nghiệm kép)<br>x₁ = x₂ = <b>${Math.round(x * 1e6) / 1e6}</b>`;
      } else {
        const real = -b / (2 * a);
        const imag = Math.sqrt(-delta) / (2 * a);
        eqResultContent.innerHTML = `Δ = ${delta} &lt; 0 (nghiệm phức)<br>x₁ = ${Math.round(real * 1e4) / 1e4} + ${Math.round(imag * 1e4) / 1e4}i<br>x₂ = ${Math.round(real * 1e4) / 1e4} − ${Math.round(imag * 1e4) / 1e4}i`;
      }
    } else if (currentEqType === 'system2') {
      const a1 = parseFloat(document.getElementById('sysA1').value) || 0;
      const b1 = parseFloat(document.getElementById('sysB1').value) || 0;
      const c1 = parseFloat(document.getElementById('sysC1').value) || 0;
      const a2 = parseFloat(document.getElementById('sysA2').value) || 0;
      const b2 = parseFloat(document.getElementById('sysB2').value) || 0;
      const c2 = parseFloat(document.getElementById('sysC2').value) || 0;

      const D = a1 * b2 - a2 * b1;
      const Dx = c1 * b2 - c2 * b1;
      const Dy = a1 * c2 - a2 * c1;

      if (D !== 0) {
        const x = Dx / D;
        const y = Dy / D;
        eqResultContent.innerHTML = `x = <b>${Math.round(x * 1e6) / 1e6}</b><br>y = <b>${Math.round(y * 1e6) / 1e6}</b>`;
      } else {
        if (Dx === 0 && Dy === 0) eqResultContent.textContent = 'Hệ phương trình có vô số nghiệm';
        else eqResultContent.textContent = 'Hệ phương trình vô nghiệm';
      }
    }
  }

  document.querySelectorAll('[data-eq-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-eq-type]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentEqType = btn.dataset.eqType;
      renderEquationForm();
    });
  });

  renderEquationForm();

  /* ======================================================== */
  /* STATISTICS (ROADMAP PHASE 1)                             */
  /* ======================================================== */
  const statInput = document.getElementById('statInput');
  const statSampleBtn = document.getElementById('statSampleBtn');
  const statClearBtn = document.getElementById('statClearBtn');

  function calculateStats() {
    const raw = statInput.value;
    const nums = raw.split(/[\s,;]+/).map(Number).filter(n => !isNaN(n));
    if (nums.length === 0) {
      document.getElementById('statCount').textContent = '0';
      document.getElementById('statSum').textContent = '0';
      document.getElementById('statMean').textContent = '0';
      document.getElementById('statMedian').textContent = '0';
      document.getElementById('statMode').textContent = '0';
      document.getElementById('statStdDev').textContent = '0';
      document.getElementById('statVariance').textContent = '0';
      document.getElementById('statMinMax').textContent = '0 / 0';
      return;
    }

    const n = nums.length;
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    // Median
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(n / 2);
    const median = n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    // Mode
    const freq = {};
    let maxFreq = 0;
    nums.forEach(x => { freq[x] = (freq[x] || 0) + 1; if (freq[x] > maxFreq) maxFreq = freq[x]; });
    const modes = Object.keys(freq).filter(k => freq[k] === maxFreq);
    const modeStr = maxFreq > 1 ? modes.join(', ') : 'None';

    // Variance & StdDev
    const variance = nums.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    document.getElementById('statCount').textContent = String(n);
    document.getElementById('statSum').textContent = String(Math.round(sum * 1e6) / 1e6);
    document.getElementById('statMean').textContent = String(Math.round(mean * 1e4) / 1e4);
    document.getElementById('statMedian').textContent = String(Math.round(median * 1e4) / 1e4);
    document.getElementById('statMode').textContent = modeStr;
    document.getElementById('statStdDev').textContent = String(Math.round(stdDev * 1e4) / 1e4);
    document.getElementById('statVariance').textContent = String(Math.round(variance * 1e4) / 1e4);
    document.getElementById('statMinMax').textContent = `${sorted[0]} / ${sorted[n - 1]}`;
  }

  statInput.addEventListener('input', calculateStats);
  statSampleBtn.addEventListener('click', () => {
    statInput.value = '12, 15, 23, 23, 16, 19, 24, 26, 30';
    calculateStats();
  });
  statClearBtn.addEventListener('click', () => {
    statInput.value = '';
    calculateStats();
  });

  /* ======================================================== */
  /* GRAPH 2D                                                 */
  /* ======================================================== */
  const graphCanvas = document.getElementById('graphCanvas');
  const graphFuncInput = document.getElementById('graphFuncInput');
  const graphPlotBtn = document.getElementById('graphPlotBtn');

  function plotGraph() {
    if (!graphCanvas) return;
    const ctx = graphCanvas.getContext('2d');
    const w = graphCanvas.width;
    const h = graphCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Axes
    const xMin = -10, xMax = 10;
    const yMin = -6, yMax = 6;

    const toCanvasX = (x) => ((x - xMin) / (xMax - xMin)) * w;
    const toCanvasY = (y) => h - ((y - yMin) / (yMax - yMin)) * h;

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    for (let x = xMin; x <= xMax; x += 2) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(x), 0);
      ctx.lineTo(toCanvasX(x), h);
      ctx.stroke();
    }
    for (let y = yMin; y <= yMax; y += 2) {
      ctx.beginPath();
      ctx.moveTo(0, toCanvasY(y));
      ctx.lineTo(w, toCanvasY(y));
      ctx.stroke();
    }

    // Axes lines
    ctx.strokeStyle = 'rgba(157, 191, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, toCanvasY(0));
    ctx.lineTo(w, toCanvasY(0));
    ctx.moveTo(toCanvasX(0), 0);
    ctx.lineTo(toCanvasX(0), h);
    ctx.stroke();

    // Plot Function
    const expr = graphFuncInput.value.trim();
    if (!expr) return;

    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    let started = false;
    const step = (xMax - xMin) / w;

    for (let x = xMin; x <= xMax; x += step) {
      try {
        const y = math.evaluate(expr, { x });
        if (typeof y === 'number' && isFinite(y)) {
          const cx = toCanvasX(x);
          const cy = toCanvasY(y);
          if (!started) {
            ctx.moveTo(cx, cy);
            started = true;
          } else {
            if (cy >= -100 && cy <= h + 100) ctx.lineTo(cx, cy);
            else started = false;
          }
        } else {
          started = false;
        }
      } catch (e) {
        started = false;
      }
    }
    ctx.stroke();
  }

  graphPlotBtn.addEventListener('click', plotGraph);
  document.querySelectorAll('[data-graph]').forEach(btn => {
    btn.addEventListener('click', () => {
      graphFuncInput.value = btn.dataset.graph;
      plotGraph();
    });
  });

  /* ======================================================== */
  /* FINANCE & DATE-TIME PLACEHOLDERS                         */
  /* ======================================================== */
  const finCalcBtn = document.getElementById('finCalcBtn');
  if (finCalcBtn) {
    finCalcBtn.addEventListener('click', () => {
      const p = parseFloat(document.getElementById('finPrincipal').value) || 0;
      const r = parseFloat(document.getElementById('finRate').value) || 0;
      const t = parseFloat(document.getElementById('finYears').value) || 0;
      const total = p * Math.pow(1 + r / 100, t);
      const interest = total - p;
      document.getElementById('finResult').innerHTML = `Tổng nhận: ${new Intl.NumberFormat('vi-VN').format(Math.round(total))} VND<br><span style="font-size:12px; color:var(--emerald);">Tiền lãi: ${new Intl.NumberFormat('vi-VN').format(Math.round(interest))} VND</span>`;
    });
  }

  const dateCalcBtn = document.getElementById('dateCalcBtn');
  if (dateCalcBtn) {
    dateCalcBtn.addEventListener('click', () => {
      const d1 = new Date(document.getElementById('dateStart').value);
      const d2 = new Date(document.getElementById('dateEnd').value);
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
        document.getElementById('dateResult').textContent = 'Vui lòng chọn đủ 2 ngày!';
        return;
      }
      const diffTime = Math.abs(d2 - d1);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      document.getElementById('dateResult').textContent = `Cách nhau ${diffDays} ngày (~ ${(diffDays / 30.4).toFixed(1)} tháng)`;
    });
  }

  /* ======================================================== */
  /* PHYSICAL KEYBOARD SHORTCUTS                              */
  /* ======================================================== */
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (activeView === 'standard') {
      if (e.key >= '0' && e.key <= '9') return inputDigit(e.key);
      if (e.key === '.') return inputDigit('.');
      const opKeyMap = { '+': '+', '-': '−', '*': '×', '/': '÷' };
      if (opKeyMap[e.key]) { e.preventDefault(); return chooseOperator(opKeyMap[e.key]); }
      if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); return computeStandard(); }
      if (e.key === 'Backspace') return deleteLastStandard();
      if (e.key === 'Escape') return resetStandard(true);
      if (e.key === '%') return percentStandard();
    } else if (activeView === 'scientific') {
      if (e.key >= '0' && e.key <= '9') return sciAppendNumber(e.key);
      if (e.key === '.') return sciAppendNumber('.');
      const opKeyMap = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };
      if (opKeyMap[e.key]) { e.preventDefault(); return sciAppendOperator(opKeyMap[e.key]); }
      if (e.key === '(') { e.preventDefault(); return sciAppendOpenParen(); }
      if (e.key === ')') { e.preventDefault(); return sciAppendCloseParen(); }
      if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); return sciEquals(); }
      if (e.key === 'Backspace') return sciBackspace();
      if (e.key === 'Escape') { sciExpr = ''; return updateSciDisplay(); }
    } else if (activeView === 'programmer') {
      if ((e.key >= '0' && e.key <= '9') || (e.key >= 'a' && e.key <= 'f') || (e.key >= 'A' && e.key <= 'F')) {
        return progInputDigit(e.key.toUpperCase());
      }
      const opKeyMap = { '+': '+', '-': '−', '*': '×', '/': '÷', '%': 'MOD' };
      if (opKeyMap[e.key]) { e.preventDefault(); return progSetOperator(opKeyMap[e.key]); }
      if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); return progCompute(); }
      if (e.key === 'Backspace') {
        const actionBtn = document.querySelector('[data-prog-action="delete"]');
        if (actionBtn) actionBtn.click();
      }
    } else if (activeView === 'converter') {
      if (e.key >= '0' && e.key <= '9') return convInputDigit(e.key);
      if (e.key === '.') return convInputDigit('.');
      if (e.key === 'Backspace') return convBackspace();
      if (e.key === 'Escape') return convClearEntry();
    }
  });

  // Initial display setup
  updateDisplay();
})();
