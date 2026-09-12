/* script.js - lengkap
   - Evaluasi hanya untuk pola di dalam tanda siku [ ... ].
   - Operator yang didukung: + - * :
   - Pembagian menggunakan ':' menghasilkan 1 desimal jika bukan integer, dengan koma sebagai pemisah desimal.
   - Fitur download dihapus.
*/

document.addEventListener('DOMContentLoaded', function () {
  const inputText = document.getElementById('inputText');
  const generateBtn = document.getElementById('generateBtn');
  const tableWrap = document.getElementById('tableWrap');
  const activeDelimEl = document.getElementById('activeDelim');
  const rowCountEl = document.getElementById('rowCount');
  const colCountEl = document.getElementById('colCount');
  const copyBtnTop = document.getElementById('copyBtnTop');
  const copyMsg = document.getElementById('copyMsg');
  const clearBtn = document.getElementById('clearBtn');
  const preset = document.getElementById('presetDelims');
  const customDelimInput = document.getElementById('customDelim');

  // ---------- parsing helper (tanpa literal regex berisiko) ----------
  function findOperatorIndex(s) {
    const ops = ['+', '*', ':', '-'];
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ops.indexOf(ch) !== -1) {
        if (ch === '-' && i === 0) continue; // minus awal = tanda negatif
        const left = s.slice(0, i).trim();
        const right = s.slice(i + 1).trim();
        if (left === '' || right === '') continue;
        if (!/[0-9.]$/.test(left)) continue;
        if (!/^[0-9.-]/.test(right)) continue;
        return i;
      }
    }
    return -1;
  }

  function parseNumberString(numStr) {
    if (typeof numStr !== 'string') return NaN;
    const s = numStr.trim().replace(',', '.');
    if (s === '') return NaN;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function formatDivisionResult(n) {
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(1).replace('.', ',');
  }

  function formatNumericResult(n) {
    if (Number.isInteger(n)) return String(n);
    return parseFloat(n.toFixed(6)).toString();
  }

  // ---------------------------
  // New: helpers untuk evaluasi ekspresi di dalam [ ... ]
  // - makeTermFromBracket: buat fungsi suku t(n) dari string (mengizinkan 'n' dan angka)
  // - evaluateInfiniteSeries: hitung sum atau product tak hingga (numerik, sinkron)
  // ---------------------------

  function makeTermFromBracket(expr, context = {}) {
    if (typeof expr !== 'string') throw new Error('expr harus string');
    // hanya izinkan karakter aman: angka, huruf n, spasi, operator, titik, tanda kurung, koma, ^, dan ':'
    // (kita tidak mengizinkan akses ke Math atau objek lain)
    const safePattern = /^[0-9n+\-*/():.\s^,_a-zA-Z]+$/;
    if (!safePattern.test(expr)) throw new Error('Ekspresi mengandung karakter tidak diizinkan');

    // terjemahkan notasi: ':' -> '/', '^' -> '**'
    const jsExpr = expr.replace(/:/g, '/').replace(/\^/g, '**');

    // hanya variabel yang diizinkan: 'n' dan variabel dari context (biasanya tidak ada)
    const varNames = Object.keys(context);
    const params = ['n', ...varNames];

    let fn;
    try {
      // Buat fungsi dinamis: function(n, a, b, ...) { return <jsExpr>; }
      fn = new Function(...params, 'return ' + jsExpr + ';');
    } catch (e) {
      throw new Error('Ekspresi tidak valid: ' + e.message);
    }

    return function(n) {
      const args = [n, ...varNames.map(k => context[k])];
      const val = fn(...args);
      if (typeof val !== 'number' || !isFinite(val)) throw new Error('Suku menghasilkan nilai tidak valid pada n=' + n);
      return val;
    };
  }

  function evaluateInfiniteSeries({ type = 'sum', termFunc, start = 0, tol = 1e-12, maxIter = 100000 }) {
    if (typeof termFunc !== 'function') throw new Error('termFunc harus function(n)');

    if (type === 'sum') {
      let s = 0;
      let prev = 0;
      for (let n = start; n < maxIter; n++) {
        let t;
        try { t = termFunc(n); } catch (e) { throw new Error('Error menghitung suku n=' + n + ': ' + e.message); }
        if (!isFinite(t)) throw new Error(`Suku tidak finite pada n=${n}`);
        s += t;
        if (Math.abs(s - prev) < tol) return s;
        prev = s;
        // deteksi divergensi praktis: suku besar terus setelah banyak iterasi
        if (n > 10000 && Math.abs(t) > 1e6) throw new Error('Kemungkinan divergen (suku besar terus)');
      }
      throw new Error('Max iterasi tercapai; deret mungkin divergen atau toleransi terlalu kecil');
    }

    if (type === 'prod') {
      // coba gunakan log-sum bila faktor positif untuk stabilitas
      let useLog = true;
      for (let n = start; n < start + 20; n++) {
        const f = termFunc(n);
        if (!(f > 0)) { useLog = false; break; }
      }
      if (useLog) {
        let logSum = 0;
        let prevLog = 0;
        for (let n = start; n < maxIter; n++) {
          const f = termFunc(n);
          if (!(f > 0)) throw new Error(`Faktor non-positif pada n=${n}`);
          logSum += Math.log(f);
          if (Math.abs(logSum - prevLog) < tol) return Math.exp(logSum);
          prevLog = logSum;
        }
        throw new Error('Max iterasi tercapai; produk mungkin divergen');
      } else {
        let prod = 1;
        let prev = 0;
        for (let n = start; n < maxIter; n++) {
          const f = termFunc(n);
          if (!isFinite(f)) throw new Error(`Faktor tidak finite pada n=${n}`);
          prod *= f;
          if (Math.abs(prod - prev) < tol) return prod;
          prev = prod;
          if (!isFinite(prod) || Math.abs(prod) > 1e300) throw new Error('Produk overflow; kemungkinan divergen');
        }
        throw new Error('Max iterasi tercapai; produk mungkin divergen');
      }
    }

    throw new Error('Tipe tidak dikenali: ' + type);
  }

  // computeWithInfinitySupport sinkron untuk penggunaan internal:
  // - jika type === 'single' -> evaluasi suku pada n = start
  // - jika type === 'sum' -> hitung sum tak hingga (sinkron)
  function computeWithInfinitySupportSync(inputExpr, context = {}, opts = {}) {
    const { type = 'sum', start = 0, tol = 1e-12, maxIter = 100000 } = opts;
    let expr = String(inputExpr).trim();
    if (expr.startsWith('[') && expr.endsWith(']')) expr = expr.slice(1, -1).trim();
    // buat termFunc
    const termFunc = makeTermFromBracket(expr, context);
    if (type === 'single') {
      return termFunc(start);
    }
    return evaluateInfiniteSeries({ type, termFunc, start, tol, maxIter });
  }

  // expose minimal function globally if needed (tidak wajib)
  if (typeof window !== 'undefined') window.computeWithInfinitySupportSync = computeWithInfinitySupportSync;

  // ---------------------------
  // Modifikasi evaluateSimpleExpression:
  // - Jika ekspresi mengandung 'n' -> coba hitung sum tak hingga (sinkron)
  // - Jika tidak -> dukung banyak operand seperti [2+2+50+30] -> 84
  // ---------------------------

  // Tokenize expression into numbers and operators (supports unary minus)
  function tokenizeExpression(s) {
    const tokens = [];
    let i = 0;
    const len = s.length;
    while (i < len) {
      const ch = s[i];
      if (ch === ' ' || ch === '\t') { i++; continue; }
      // operator
      if (ch === '+' || ch === '*' || ch === ':' ) {
        tokens.push({ type: 'op', value: ch });
        i++; continue;
      }
      if (ch === '-') {
        // could be unary minus if at start or after another operator
        const prev = tokens.length ? tokens[tokens.length - 1] : null;
        if (!prev || (prev.type === 'op')) {
          // parse number with leading minus
          let j = i + 1;
          let numStr = '-';
          let dotCount = 0;
          while (j < len) {
            const c = s[j];
            if ((c >= '0' && c <= '9') || c === ',' || c === '.') {
              if (c === '.' || c === ',') dotCount++;
              numStr += c;
              j++;
            } else break;
          }
          if (numStr === '-' || numStr === '-.' || numStr === '-,') return null;
          tokens.push({ type: 'num', value: numStr });
          i = j;
          continue;
        } else {
          // binary minus
          tokens.push({ type: 'op', value: '-' });
          i++; continue;
        }
      }
      // number (digits, dot or comma)
      if ((ch >= '0' && ch <= '9') || ch === '.' || ch === ',') {
        let j = i;
        let numStr = '';
        while (j < len) {
          const c = s[j];
          if ((c >= '0' && c <= '9') || c === '.' || c === ',') {
            numStr += c;
            j++;
          } else break;
        }
        tokens.push({ type: 'num', value: numStr });
        i = j;
        continue;
      }
      // any other character -> invalid for simple numeric expression
      return null;
    }
    return tokens;
  }

  // Evaluate token list with precedence: first * and :, then + and -
  function evalTokenList(tokens) {
    if (!Array.isArray(tokens) || tokens.length === 0) return null;
    // convert number strings to numeric values
    const vals = [];
    for (let t of tokens) {
      if (t.type === 'num') {
        const n = parseNumberString(String(t.value));
        if (isNaN(n)) return null;
        vals.push({ type: 'num', value: n });
      } else {
        vals.push(t);
      }
    }
    // first pass: handle * and :
    let i = 0;
    const pass1 = [];
    while (i < vals.length) {
      const cur = vals[i];
      if (cur.type === 'num') {
        // lookahead for * or :
        const nextOp = vals[i + 1];
        if (nextOp && nextOp.type === 'op' && (nextOp.value === '*' || nextOp.value === ':')) {
          const right = vals[i + 2];
          if (!right || right.type !== 'num') return null;
          let res;
          if (nextOp.value === '*') res = cur.value * right.value;
          else { // division
            if (right.value === 0) return NaN;
            res = cur.value / right.value;
          }
          // replace current triple with result and continue (may chain)
          vals.splice(i, 3, { type: 'num', value: res });
          // do not increment i, re-evaluate at same position (to handle chaining like a * b * c)
          continue;
        } else {
          pass1.push(cur);
          i++;
        }
      } else {
        // operator + or - (or unexpected)
        pass1.push(cur);
        i++;
      }
    }

    // second pass: handle + and - left-to-right
    if (pass1.length === 0) return null;
    // must start with number
    if (pass1[0].type !== 'num') return null;
    let acc = pass1[0].value;
    i = 1;
    while (i < pass1.length) {
      const op = pass1[i];
      const right = pass1[i + 1];
      if (!op || !right || op.type !== 'op' || right.type !== 'num') return null;
      if (op.value === '+') acc = acc + right.value;
      else if (op.value === '-') acc = acc - right.value;
      else return null; // unexpected operator here
      i += 2;
    }
    return acc;
  }

  function evaluateSimpleExpression(expr) {
    if (typeof expr !== 'string') return null;
    const s = expr.trim();
    if (s.length === 0) return null;

    // jika mengandung 'n' -> deret tak hingga (sum)
    if (/\bn\b/.test(s)) {
      try {
        const val = computeWithInfinitySupportSync('[' + s + ']', {}, { type: 'sum' });
        return formatNumericResult(val);
      } catch (e) {
        return null;
      }
    }

    // tokenisasi untuk mendukung banyak operand, unary minus, dan operator + - * :
    const tokens = tokenizeExpression(s);
    if (!tokens) return null;

    // validate tokens sequence: must alternate num op num op ...
    if (tokens.length === 0) return null;
    // quick check: first token must be num
    if (tokens[0].type !== 'num') return null;

    // evaluate with precedence
    const numericResult = evalTokenList(tokens);
    if (numericResult === null) return null;
    if (!isFinite(numericResult)) return null;

    // If original expression contained ':' (division) and no 'n', format division style (1 decimal, comma)
    if (s.indexOf(':') !== -1) {
      return formatDivisionResult(numericResult);
    }
    // otherwise normal numeric formatting
    return formatNumericResult(numericResult);
  }

  // Proses hanya pola [ ... ] — tidak menggunakan regex literal
  function processBracketExpressions(text) {
    if (typeof text !== 'string' || text.length === 0) return text;
    let out = '';
    let i = 0;
    while (i < text.length) {
      const openIdx = text.indexOf('[', i);
      if (openIdx === -1) {
        out += text.slice(i);
        break;
      }
      out += text.slice(i, openIdx);
      const closeIdx = text.indexOf(']', openIdx + 1);
      if (closeIdx === -1) {
        out += text.slice(openIdx);
        break;
      }
      const inner = text.slice(openIdx + 1, closeIdx);
      const evalResult = evaluateSimpleExpression(inner);
      if (evalResult === null) {
        out += '[' + inner + ']';
      } else {
        out += evalResult;
      }
      i = closeIdx + 1;
    }
    return out;
  }

  // ---------- delimiter & UI helpers ----------
  function getSelectedDelimiter(){
    const radios = document.querySelectorAll('input[name="delim"]');
    let val = '/';
    radios.forEach(r=>{
      if(r.checked) val = r.value;
    });
    if(val === 'tab') return '\t';
    if(val === 'custom') {
      const c = customDelimInput.value || '';
      return c === '' ? '/' : c;
    }
    return val;
  }

  preset.addEventListener('change', ()=>{
    const sel = document.querySelector('input[name="delim"]:checked').value;
    if(sel === 'custom'){
      customDelimInput.style.display = 'block';
      customDelimInput.focus();
    } else {
      customDelimInput.style.display = 'none';
    }
    activeDelimEl.textContent = (sel === 'tab') ? 'Tab' : (sel === 'custom' ? (customDelimInput.value || '(kosong)') : sel);
  });

  customDelimInput.addEventListener('input', ()=>{
    const sel = document.querySelector('input[name="delim"]:checked').value;
    if(sel === 'custom'){
      activeDelimEl.textContent = customDelimInput.value || '(kosong)';
    }
  });

  function splitLine(line, delim){
    if(delim === '\t') return line.split('\t');
    if (delim === '') return [line];
    return line.split(delim);
  }
  function trimAll(arr){
    return arr.map(s => s === undefined ? '' : String(s).trim());
  }

  // caret helpers
  function insertTextAtCaret(text) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  function placeCaretAtEnd(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // keyboard navigation for cells
  function handleCellKeydown(ev, ri, ci) {
    if (ev.key === 'Enter') {
      if (ev.shiftKey) {
        ev.preventDefault();
        insertTextAtCaret('\n');
      } else {
        ev.preventDefault();
        const next = findCell(ri, ci + 1) || findCell(ri + 1, 0);
        if (next) {
          next.focus();
          placeCaretAtEnd(next);
        }
      }
    }
    if (ev.key === 'Tab') {
      ev.preventDefault();
      const next = findCell(ri, ci + (ev.shiftKey ? -1 : 1));
      if (next) {
        next.focus();
        placeCaretAtEnd(next);
      }
    }
  }

  // ---------- table generation ----------
  function generateTable(){
    copyMsg.textContent = '';
    const raw = inputText.value.replace(/\r/g,'');
    const rawLines = raw.split('\n');

    const firstNonEmptyIndex = rawLines.findIndex(l => l.trim() !== '');
    if(firstNonEmptyIndex === -1){
      tableWrap.innerHTML = '<div class="info" style="color:var(--muted)">Tidak ada teks. Paste teks panjang lalu klik Generate Table.</div>';
      rowCountEl.textContent = '0';
      colCountEl.textContent = '0';
      return;
    }

    const delim = getSelectedDelimiter();
    activeDelimEl.textContent = (delim === '\t') ? 'Tab' : delim;

    const headerCols = splitLine(rawLines[firstNonEmptyIndex], delim).length;

    const parsedRows = rawLines.map(line => {
      if(line.trim() === '') return { type: 'empty' };
      const parts = splitLine(line, delim).map(p => p === undefined ? '' : String(p));
      while(parts.length < headerCols) parts.push('');
      return { type: 'row', cells: trimAll(parts) };
    });

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    for(let c=0;c<headerCols;c++){
      const th = document.createElement('th');
      th.textContent = 'Kolom ' + (c+1);
      trh.appendChild(th);
    }
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');

    parsedRows.forEach((r, ri)=>{
      const tr = document.createElement('tr');
      if(r.type === 'empty'){
        const td = document.createElement('td');
        td.setAttribute('colspan', headerCols);
        td.contentEditable = 'true';
        td.spellcheck = false;
        td.dataset.emptyRow = 'true';
        td.dataset.row = ri;
        td.dataset.col = 0;
        td.textContent = '';
        td.addEventListener('keydown', (ev)=>{ handleCellKeydown(ev, ri, 0); });
        td.addEventListener('paste', (ev)=>{
          ev.preventDefault();
          const text = (ev.clipboardData || window.clipboardData).getData('text');
          const sanitized = text.replace(/\r/g,'').replace(/\n+/g,' ');
          insertTextAtCaret(sanitized);
        });
        tr.appendChild(td);
      } else {
        r.cells.forEach((cell, ci)=>{
          const td = document.createElement('td');
          td.contentEditable = 'true';
          td.spellcheck = false;
          td.dataset.row = ri;
          td.dataset.col = ci;
          td.textContent = String(cell).replace(/\n+/g, ' ');
          td.addEventListener('keydown', (ev)=>{ handleCellKeydown(ev, ri, ci); });
          td.addEventListener('paste', (ev)=>{
            ev.preventDefault();
            const text = (ev.clipboardData || window.clipboardData).getData('text');
            const sanitized = text.replace(/\r/g,'').replace(/\n+/g,' ');
            insertTextAtCaret(sanitized);
          });
          tr.appendChild(td);
        });
      }
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableWrap.innerHTML = '';
    tableWrap.appendChild(table);

    rowCountEl.textContent = parsedRows.length;
    colCountEl.textContent = headerCols;

    setTimeout(()=>{
      const firstEditable = table.querySelector('td[contenteditable]');
      if(firstEditable) {
        firstEditable.focus();
        placeCaretAtEnd(firstEditable);
      }
    }, 200);
  }

  function findCell(row, col){
    return document.querySelector('td[data-row="'+row+'"][data-col="'+col+'"]') ||
           document.querySelector('td[data-row="'+row+'"][data-empty-row="true"]');
  }

  generateBtn.addEventListener('click', generateTable);
  inputText.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){
      e.preventDefault();
      generateTable();
    }
  });

  clearBtn.addEventListener('click', ()=>{
    inputText.value = '';
    tableWrap.innerHTML = '<div class="info" style="color:var(--muted)">Tabel akan muncul setelah klik Generate Table</div>';
    rowCountEl.textContent = '0';
    colCountEl.textContent = '0';
    copyMsg.textContent = '';
  });

  // ---------- build output and copy (hanya evaluasi isi dalam [..]) ----------
  function buildOutputText(){
    const delim = getSelectedDelimiter();
    const table = tableWrap.querySelector('table');
    if(!table) return '';
    const headerCols = table.querySelectorAll('thead th').length || 1;
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const outLines = [];

    rows.forEach(tr=>{
      const emptyCell = tr.querySelector('td[data-empty-row="true"]');
      if(emptyCell){
        const txtRaw = emptyCell.textContent.replace(/\r/g,'').replace(/\n+/g,' ').trim();
        const txtProcessed = processBracketExpressions(txtRaw);
        if(txtProcessed === ''){
          outLines.push('');
        } else {
          const currentDelim = getSelectedDelimiter();
          const delimForCheck = currentDelim === '\t' ? '\t' : currentDelim;
          if(txtProcessed.includes(delimForCheck)){
            const parts = splitLine(txtProcessed, currentDelim);
            while(parts.length < headerCols) parts.push('');
            outLines.push(trimAll(parts).join(currentDelim));
          } else {
            const parts = [txtProcessed];
            while(parts.length < headerCols) parts.push('');
            outLines.push(trimAll(parts).join(currentDelim));
          }
        }
      } else {
        const tds = Array.from(tr.querySelectorAll('td'));
        const cells = tds.map(td => {
          const raw = td.textContent.replace(/\r/g,'').replace(/\n+/g,' ').trim();
          return processBracketExpressions(raw);
        });
        const allEmpty = cells.every(c => c === '');
        if(allEmpty){
          outLines.push('');
        } else {
          outLines.push(cells.join(getSelectedDelimiter()));
        }
      }
    });

    return outLines.join('\n');
  }

  async function copyToClipboard(){
    copyMsg.textContent = '';
    const text = buildOutputText();
    if(text === null || text === undefined){
      copyMsg.textContent = 'Tidak ada tabel untuk disalin.';
      return;
    }
    try{
      await navigator.clipboard.writeText(text);
      copyMsg.textContent = 'Teks berhasil disalin ke clipboard.';
      setTimeout(()=> copyMsg.textContent = '', 3000);
    }catch(err){
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try{ document.execCommand('copy'); copyMsg.textContent = 'Teks berhasil disalin (fallback).'; }
      catch(e){ copyMsg.textContent = 'Gagal menyalin otomatis. Salin manual.'; }
      ta.remove();
      setTimeout(()=> copyMsg.textContent = '', 3000);
    }
  }

  copyBtnTop.addEventListener('click', copyToClipboard);

  // initial state
  activeDelimEl.textContent = '/';
});
