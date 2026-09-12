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

  function evaluateSimpleExpression(expr) {
    if (typeof expr !== 'string') return null;
    const s = expr.trim();
    if (s.length === 0) return null;

    const opIndex = findOperatorIndex(s);
    if (opIndex === -1) return null;

    const op = s[opIndex];
    const leftRaw = s.slice(0, opIndex).trim();
    const rightRaw = s.slice(opIndex + 1).trim();

    const a = parseNumberString(leftRaw);
    const b = parseNumberString(rightRaw);
    if (isNaN(a) || isNaN(b)) return null;

    let result;
    switch (op) {
      case '+':
        result = a + b;
        return formatNumericResult(result);
      case '-':
        result = a - b;
        return formatNumericResult(result);
      case '*':
        result = a * b;
        return formatNumericResult(result);
      case ':': // pembagian sesuai permintaan
        if (b === 0) return 'NaN';
        result = a / b;
        return formatDivisionResult(result);
      default:
        return null;
    }
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
