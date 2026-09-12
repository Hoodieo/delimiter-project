/* script.js */
document.addEventListener('DOMContentLoaded', function () {
  const inputText = document.getElementById('inputText');
  const generateBtn = document.getElementById('generateBtn');
  const tableWrap = document.getElementById('tableWrap');
  const activeDelimEl = document.getElementById('activeDelim');
  const rowCountEl = document.getElementById('rowCount');
  const colCountEl = document.getElementById('colCount');
  const copyBtnTop = document.getElementById('copyBtnTop');
  const downloadBtnTop = document.getElementById('downloadBtnTop');
  const copyMsg = document.getElementById('copyMsg');
  const clearBtn = document.getElementById('clearBtn');
  const preset = document.getElementById('presetDelims');
  const customDelimInput = document.getElementById('customDelim');

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

  // keyboard helpers for editable cells
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

  /**
   * GENERATE TABLE
   * - Tetap mempertahankan baris kosong (empty lines) dari input
   * - Menentukan jumlah kolom berdasarkan baris header pertama yang tidak kosong
   * - Baris kosong dibuat sebagai single-cell row dengan atribut data-empty-row="true"
   */
  function generateTable(){
    copyMsg.textContent = '';
    const raw = inputText.value.replace(/\r/g,'');
    // keep all lines including empty ones
    const rawLines = raw.split('\n');

    // find first non-empty line to determine column count
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

    // build internal representation preserving empty lines
    const parsedRows = rawLines.map(line => {
      if(line.trim() === '') return { type: 'empty' };
      const parts = splitLine(line, delim).map(p => p === undefined ? '' : String(p));
      // pad to headerCols
      while(parts.length < headerCols) parts.push('');
      return { type: 'row', cells: trimAll(parts) };
    });

    // build table DOM
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
        // single editable cell spanning all columns to represent an empty line
        const td = document.createElement('td');
        td.setAttribute('colspan', headerCols);
        td.contentEditable = 'true';
        td.spellcheck = false;
        td.dataset.emptyRow = 'true';
        td.dataset.row = ri;
        td.dataset.col = 0;
        td.textContent = ''; // keep visually empty
        // key handlers: Enter should move to next row, Shift+Enter insert newline
        td.addEventListener('keydown', (ev)=>{
          // treat as cell at column 0 for navigation
          handleCellKeydown(ev, ri, 0);
        });
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
          td.addEventListener('keydown', (ev)=>{
            handleCellKeydown(ev, ri, ci);
          });
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
      // focus first editable cell
      const firstEditable = table.querySelector('td[contenteditable]');
      if(firstEditable) {
        firstEditable.focus();
        placeCaretAtEnd(firstEditable);
      }
    }, 200);
  }

  function findCell(row, col){
    // for empty-row cells we used col=0 and data-empty-row flag
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

  /**
   * BUILD OUTPUT TEXT
   * - Untuk baris yang awalnya kosong (data-empty-row) dan tetap kosong => keluarkan baris kosong (preserve newline)
   * - Jika user mengetik sesuatu di empty-row:
   *    - Jika mengandung delimiter => split sesuai delimiter dan pad ke headerCols
   *    - Jika tidak mengandung delimiter => treat as first cell, pad sisanya kosong
   * - Untuk normal rows => join cells dengan delimiter
   */
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
        const txt = emptyCell.textContent.replace(/\r/g,'').replace(/\n+/g,' ').trim();
        if(txt === ''){
          // preserve blank line
          outLines.push('');
        } else {
          // user typed into the empty-row: interpret content
          if(txt.includes(getSelectedDelimiter() === '\t' ? '\t' : getSelectedDelimiter())){
            const parts = splitLine(txt, getSelectedDelimiter());
            while(parts.length < headerCols) parts.push('');
            outLines.push(trimAll(parts).join(getSelectedDelimiter()));
          } else {
            // treat as first column value
            const parts = [txt];
            while(parts.length < headerCols) parts.push('');
            outLines.push(trimAll(parts).join(getSelectedDelimiter()));
          }
        }
      } else {
        const tds = Array.from(tr.querySelectorAll('td'));
        const cells = tds.map(td => td.textContent.replace(/\r/g,'').replace(/\n+/g,' ').trim());
        // if all cells empty, output empty line (preserve)
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

  function downloadText(){
    const text = buildOutputText();
    if(!text && text !== '') return;
    const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'delimiter-output.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  downloadBtnTop.addEventListener('click', downloadText);

  // initial state
  activeDelimEl.textContent = '/';
});
