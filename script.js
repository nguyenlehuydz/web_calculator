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
  const menuToggle = document.getElementById('menuToggle');
  const modeMenu = document.getElementById('modeMenu');
  const calculatorDisplay = document.querySelector('.calculator');
  const MAX_DIGITS = 14;

  const OP_MAP = { '+': '+', '−': '-', '×': '*', '÷': '/', 'mod': 'mod', '^': '^' };

  // Trỏ tới 2 bàn phím khác nhau
  const keypadStandard = document.getElementById('keypad-standard');
  const keypadScientific = document.getElementById('keypad-scientific');

  let current = '0';
  let previous = null;
  let operator = null;
  let overwrite = true;
  let memory = 0;
  let history = [];
  const clickSound = new Audio('click_2.mp3');
  clickSound.volume = 0.6; 

  function createRipple(e, button) {
    // 1. Chạy âm thanh an toàn
    try {
      clickSound.currentTime = 0;
      clickSound.play().catch(() => {
      });
    } catch (err) {}

    // 2. Tạo hình ảnh gợn sóng
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    
    // Tính toán vị trí chuột click để tâm gợn sóng xuất phát đúng chỗ
    const rect = button.getBoundingClientRect();
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - rect.left - radius}px`;
    circle.style.top = `${e.clientY - rect.top - radius}px`;
    circle.classList.add('ripple');
    
    // Xóa gợn sóng cũ đang chạy lở dở (nếu bấm quá nhanh)
    const existingRipple = button.querySelector('.ripple');
    if (existingRipple) existingRipple.remove();
    
    button.appendChild(circle);

    // 3. QUAN TRỌNG: Tự động xóa thẻ span sau 500ms (bằng thời gian animation)
    // Nếu không xóa, web sẽ bị tràn ngập thẻ span rác gây lag
    setTimeout(() => {
      circle.remove();
    }, 500);
  }

  // Bắt sự kiện mousedown trên toàn bộ keypad để kích hoạt hiệu ứng nhanh nhất


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

  function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) return NaN; // Chỉ tính giai thừa số nguyên dương
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    return result;
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
      case 'mod': result = a % b; break; // Thêm mod
      case '^': result = Math.pow(a, b); break; // Thêm x^y
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

  menuToggle.addEventListener('click', () => {
    modeMenu.classList.toggle('show');
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      const mode = e.target.dataset.mode;
      
      // Xử lý chuyển đổi bàn phím
      if (mode === 'scientific') {
        keypadStandard.style.display = 'none';
        keypadScientific.style.display = 'grid'; // Kích hoạt lưới 5x7
      } else if (mode === 'standard') {
        keypadStandard.style.display = 'grid'; // Trở lại lưới 4 cột
        keypadScientific.style.display = 'none';
      }
      
      modeMenu.classList.remove('show');
      resetAll(true); 
    });
  });

  // Bắt sự kiện tạo hiệu ứng âm thanh cho TOÀN BỘ nút trên máy tính (sửa lại event)
  document.querySelectorAll('.keypad').forEach(pad => {
    
    // 1. GỌI HIỆU ỨNG GỢN SÓNG VÀ ÂM THANH KHI NHẤN CHUỘT XUỐNG
    pad.addEventListener('mousedown', (e) => {
      const btn = e.target.closest('.key');
      if (btn) createRipple(e, btn);
    });
    
    // 2. GỌI LOGIC TÍNH TOÁN KHI NHẢ CHUỘT LÊN (CLICK)
    pad.addEventListener('click', (e) => {
      const btn = e.target.closest('.key');
      if (!btn) return;
      
      const { num, op, action, func } = btn.dataset; // Thêm func vào đây
      
      // Xử lý các nút hàm khoa học (tác động trực tiếp lên số hiện tại)
      if (func !== undefined) {
        if (current === 'Lỗi') return;
        let val = parseFloat(current);
        let resultVal;

        switch (func) {
          case 'square': resultVal = val * val; break;
          case 'inverse': 
            if (val === 0) { current = 'Lỗi'; updateDisplay(); return; }
            resultVal = 1 / val; break;
          case 'abs': resultVal = Math.abs(val); break;
          case 'exp': resultVal = Math.exp(val); break;
          case 'sqrt': 
            if (val < 0) { current = 'Lỗi'; updateDisplay(); return; }
            resultVal = Math.sqrt(val); break;
          case 'factorial': resultVal = factorial(val); break;
          case 'ten-pow': resultVal = Math.pow(10, val); break;
          case 'log': 
            if (val <= 0) { current = 'Lỗi'; updateDisplay(); return; }
            resultVal = Math.log10(val); break;
          case 'ln': 
            if (val <= 0) { current = 'Lỗi'; updateDisplay(); return; }
            resultVal = Math.log(val); break;
        }
        
        // Làm tròn lỗi số thực (VD: 0.1 + 0.2)
        if (!isNaN(resultVal)) {
             resultVal = Math.round((resultVal + Number.EPSILON) * 1e10) / 1e10;
             current = String(resultVal);
        } else {
             current = "Lỗi";
        }
        overwrite = true;
        updateDisplay();
        return;
      }

      if (num !== undefined) return inputDigit(num);
      if (op !== undefined) return chooseOperator(op);
      
      switch (action) {
        case 'clear': return resetAll(true);
        case 'delete': return deleteLast();
        case 'percent': return percent();
        case 'equals': return compute();
        case 'toggle-sign': // Nút +/-
             if (current !== '0' && current !== 'Lỗi') {
                 current = current.startsWith('-') ? current.slice(1) : '-' + current;
                 updateDisplay();
             }
             return;
        case 'mem-clear': 
          memory = 0; 
          return updateDisplay();
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