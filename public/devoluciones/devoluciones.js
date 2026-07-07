    let workbookOriginal=null, sheetName="", worksheetOriginal=null;
    let originalRowsData=[], headers=[], devolutionSet=new Set(), auditLog=[];

    const guiaInput       = document.getElementById('guiaInput');
    const marcarBtn       = document.getElementById('marcarBtn');
    const limpiarBtn      = document.getElementById('limpiarBtn');
    const loadFileBtn     = document.getElementById('loadFileBtn');
    const exportBtn       = document.getElementById('exportBtn');
    const resetBtn        = document.getElementById('resetBtn');
    const tableHeader     = document.getElementById('tableHeader');
    const tableBody       = document.getElementById('tableBody');
    const lastScanCard    = document.getElementById('lastScanCard');
    const lastGuiaSpan    = document.getElementById('lastGuiaSpan');
    const lastDistribuidor= document.getElementById('lastDistribuidor');
    const lastProveedor   = document.getElementById('lastProveedor');
    const lastCliente     = document.getElementById('lastCliente');
    const lastArticulos   = document.getElementById('lastArticulos');
    const lastEstado      = document.getElementById('lastEstado');
    const totalCountSpan  = document.getElementById('totalCount');
    const devueltasCountSpan = document.getElementById('devueltasCount');
    const pendientesCountSpan= document.getElementById('pendientesCount');
    const progressBar     = document.getElementById('progressBar');
    const progressPct     = document.getElementById('progressPct');
    const logEntriesDiv   = document.getElementById('logEntries');

    function saveLogs(){ localStorage.setItem(STORAGE_KEYS.DEV_LOG, JSON.stringify(auditLog.slice(-200))); }
    function loadLogs(){
        try{ const s=localStorage.getItem(STORAGE_KEYS.DEV_LOG); if(s){ auditLog=JSON.parse(s); renderLogs(); } }catch(e){}
    }
    function addLog(guia,dist,prov,cliente,prod,action){
        auditLog.unshift({ts:new Date().toLocaleString('es-CR'),guia,dist,prov,cliente,prod,action});
        if(auditLog.length>300) auditLog.pop();
        renderLogs(); saveLogs();
    }
    function renderLogs(){
        if(!auditLog.length){ logEntriesDiv.innerHTML='<span style="color:rgba(255,255,255,.15)">Sin registros</span>'; return; }
        logEntriesDiv.innerHTML=auditLog.slice(0,60).map(l=>{
            const cls=l.action.includes('MARCADA')?'log-ok':'log-er';
            return `<div class="log-row"><span class="log-ts">[${esc(l.ts)}]</span> <span class="${cls}">${esc(l.action)}</span> — <span class="log-gu">Guía: ${esc(l.guia)}</span> | ${esc(l.cliente)}</div>`;
        }).join('');
    }

    function saveMarks(){ localStorage.setItem(STORAGE_KEYS.DEV_MARKS, JSON.stringify([...devolutionSet])); }
    function loadMarks(){
        try{ const s=localStorage.getItem(STORAGE_KEYS.DEV_MARKS); if(s){ devolutionSet.clear(); JSON.parse(s).forEach(m=>devolutionSet.add(m)); } }catch(e){}
    }

    function updateStats(){
        const total=originalRowsData.length, dev=devolutionSet.size, pend=total-dev;
        const pct=total>0?Math.round(dev/total*100):0;
        totalCountSpan.innerText=total;
        devueltasCountSpan.innerText=dev;
        pendientesCountSpan.innerText=pend;
        progressBar.style.width=pct+'%';
        progressPct.innerText=pct+'%';
        const pl=document.getElementById('progressLeft');
        const pr=document.getElementById('progressRight');
        if(pl) pl.innerText=`${dev} devueltas`;
        if(pr) pr.innerText=`de ${total} totales`;
        const cnt=document.getElementById('tablaContador');
        if(cnt) cnt.innerText=originalRowsData.length;
    }

    function showLastScan(guia,dist,prov,cliente,marcada,articulos){
        lastGuiaSpan.innerText=guia;
        lastDistribuidor.innerText=dist||'—';
        lastProveedor.innerText=prov||'—';
        lastCliente.innerText=cliente||'—';
        // Renderizar pares ID + Nombre
        if(articulos && articulos.length){
            lastArticulos.innerHTML=articulos.map(a=>
                `<div class="articulo-row">
                    ${a.id?`<span class="articulo-id">${esc(a.id)}</span>`:''}
                    <span class="articulo-nombre">${esc(a.nombre)||'<em style="color:var(--neutral-400)">Sin descripción</em>'}</span>
                </div>`
            ).join('');
        } else {
            lastArticulos.innerHTML='<span style="color:var(--neutral-400)">—</span>';
        }
        lastEstado.innerHTML=marcada
            ?'<span class="badge badge-ok"><i class="fas fa-check-circle"></i> Devuelta</span>'
            :'<span class="badge badge-pend"><i class="fas fa-clock"></i> Pendiente</span>';
        lastScanCard.style.display='block';
    }

    function renderTable(){
        if(!originalRowsData.length){
            tableBody.innerHTML=`<tr><td colspan="99" style="padding:0;border:none;"><div class="empty"><span class="empty-ico">📂</span><div class="empty-t">Sin datos cargados</div><div class="empty-s">Cargue un archivo Excel para comenzar</div></div></td></tr>`;
            updateStats(); return;
        }
        const sorted=[...originalRowsData].sort((a,b)=>{
            const dA=devolutionSet.has(String(a['Guía transportadora']||''));
            const dB=devolutionSet.has(String(b['Guía transportadora']||''));
            return dA===dB?0:dA?-1:1;
        });
        tableBody.innerHTML=sorted.map(row=>{
            const guia=row['Guía transportadora']!==undefined?String(row['Guía transportadora']):'';
            const isDev=devolutionSet.has(guia);
            const cells=headers.map(h=>`<td>${esc(String(row[h]??''))}</td>`).join('');
            return `<tr class="${isDev?'row-dev':''}" data-guia="${esc(guia)}"><td style="text-align:center"><input type="checkbox" class="chk" data-guia="${esc(guia)}" ${isDev?'checked':''}></td>${cells}</tr>`;
        }).join('');

        // Los listeners se atan una sola vez acá (renderTable completo solo
        // corre en la carga inicial y en initTable) — marcar/desmarcar una
        // guía después ya no reconstruye la tabla, ver updateRowStatus().
        document.querySelectorAll('.chk').forEach(cb=>{
            cb.addEventListener('change',()=>{
                const g=cb.getAttribute('data-guia'); if(!g) return;
                const r=originalRowsData.find(x=>String(x['Guía transportadora'])===g);
                const dist=r?.['Distribuidor']||'';
                const prov=r?.['Proveedor Dropshipping']||'';
                const cliente=r?.['Destinatario']||'Desconocido';
                const articulos=getProductArticulos(g);
                const prod=articulos.length?articulos.map(a=>a.nombre||a.id).join(', '):'Producto';
                if(cb.checked){
                    devolutionSet.add(g); addLog(g,dist,prov,cliente,prod,'✅ MARCADA');
                    showLastScan(g,dist,prov,cliente,true,articulos);
                    notify(`Guía ${g} marcada`,'ok');
                } else {
                    devolutionSet.delete(g); addLog(g,dist,prov,cliente,prod,'❌ DESMARCADA');
                    showLastScan(g,dist,prov,cliente,false,articulos);
                    notify(`Guía ${g} desmarcada`,'inf');
                }
                updateRowStatus(g,cb.checked);
                saveMarks(); updateStats();
            });
        });
        updateStats();
    }

    // Actualiza en el DOM ya existente la fila de una guía (clase CSS +
    // estado del checkbox) sin reconstruir la tabla — evita el freeze de
    // varios segundos que causaba renderTable() completo con 9000 filas.
    function updateRowStatus(guia,isDev){
        const tr=tableBody.querySelector(`tr[data-guia="${CSS.escape(guia)}"]`);
        if(!tr) return false;
        tr.classList.toggle('row-dev',isDev);
        const cb=tr.querySelector('.chk');
        if(cb) cb.checked=isDev;
        return true;
    }

    function initTable(){
        if(!originalRowsData.length) return;
        tableHeader.innerHTML=`<tr><th style="width:46px;text-align:center;">✔</th>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr>`;
        renderTable();
    }

    const filtrarTablaDebounced = debounce(function(query){
        const term=query.trim().toLowerCase();
        // Calcular el índice real de la columna "Guía transportadora" en la tabla
        // columna 0 = checkbox, columna 1+ = headers
        const guiaColIdx = headers.indexOf('Guía transportadora');
        const tdIdx = guiaColIdx >= 0 ? guiaColIdx + 2 : 2; // +1 por checkbox, +1 porque nth-child es 1-based
        const filas=document.querySelectorAll('#tableBody tr');
        let visibles=0;
        filas.forEach(tr=>{
            if(tr.querySelector('.empty')){ tr.style.display=''; return; }
            if(!term){ tr.style.display=''; visibles++; return; }
            // Buscar en toda la fila para mayor flexibilidad
            const textoFila=tr.textContent.trim().toLowerCase();
            const coincide=textoFila.includes(term);
            tr.style.display=coincide?'':'none';
            if(coincide) visibles++;
        });
        const cnt=document.getElementById('tablaContador');
        if(cnt){
            const total=Array.from(filas).filter(tr=>!tr.querySelector('.empty')).length;
            cnt.textContent=term?`${visibles} de ${total}`:total;
        }
    }, 200);
    function filtrarTabla(query) { filtrarTablaDebounced(query); }

    function getIdColumnName(){
        // Detecta dinámicamente el nombre de la columna de ID artículo
        const candidates=['ID artículo','ID Artículo','Id artículo','id artículo','ID articulo','ID Articulo','id articulo'];
        return candidates.find(c=>headers.includes(c))||null;
    }

    function getProductArticulos(guia){
        // Devuelve array de {id, nombre} únicos para todas las filas de esa guía
        const idCol=getIdColumnName();
        const nombreCandidates=['Descripción original artículo','Descripcion original articulo','Descripción artículo','Nombre artículo','Nombre','nombre'];
        const nombreCol=nombreCandidates.find(c=>headers.includes(c))||null;
        const rows=originalRowsData.filter(x=>String(x['Guía transportadora'])===guia);
        const seen=new Set();
        const articulos=[];
        rows.forEach(r=>{
            const id=idCol?String(r[idCol]||'').trim():'';
            const nombre=nombreCol?String(r[nombreCol]||'').trim():'';
            const key=id+'|'+nombre;
            if(!seen.has(key)&&(id||nombre)){ seen.add(key); articulos.push({id,nombre}); }
        });
        return articulos;
    }

    function marcarGuia(raw){
        const guia=String(raw).trim();
        if(!guia){ notify('Ingrese un número de guía','err'); guiaInput.focus(); return false; }
        const r=originalRowsData.find(x=>String(x['Guía transportadora'])===guia);
        if(!r){ notify(`Guía ${guia} no encontrada`,'err'); guiaInput.value=''; guiaInput.focus(); return false; }
        const dist=r['Distribuidor']||'', prov=r['Proveedor Dropshipping']||'';
        const cliente=r['Destinatario']||'Desconocido';
        const articulos=getProductArticulos(guia);
        const prod=articulos.length?articulos.map(a=>a.nombre||a.id).join(', '):'Producto';
        if(!devolutionSet.has(guia)){
            devolutionSet.add(guia); addLog(guia,dist,prov,cliente,prod,'✅ MARCADA (escáner)');
            showLastScan(guia,dist,prov,cliente,true,articulos);
            notify(`Guía ${guia} marcada`,'ok');
            updateRowStatus(guia,true); saveMarks(); updateStats();
        } else {
            showLastScan(guia,dist,prov,cliente,true,articulos);
            notify(`Guía ${guia} ya estaba marcada`,'inf');
        }
        guiaInput.value=''; guiaInput.focus(); return true;
    }

    function loadExcelFile(){
        const inp=document.createElement('input');
        inp.type='file'; inp.accept='.xlsx,.xls';
        inp.onchange=e=>{
            const file=e.target.files[0]; if(!file) return;
            document.getElementById('fileLabel').textContent=file.name;
            const reader=new FileReader();
            reader.onload=evt=>{
                try{
                    const wb=XLSX.read(new Uint8Array(evt.target.result),{type:'array',cellStyles:true});
                    workbookOriginal=wb; sheetName=wb.SheetNames[0]; worksheetOriginal=wb.Sheets[sheetName];
                    const json=XLSX.utils.sheet_to_json(worksheetOriginal,{defval:""});
                    if(!json.length){ notify("Excel sin datos",'err'); return; }
                    const sh=XLSX.utils.sheet_to_json(worksheetOriginal,{header:1})[0];
                    headers=sh?[...sh]:Object.keys(json[0]);
                    originalRowsData=json.map(row=>{ const nr={}; headers.forEach(h=>nr[h]=row[h]??''); return nr; });
                    loadMarks(); initTable();
                    lastScanCard.style.display='none'; updateStats();
                    notify(`${originalRowsData.length} registros cargados`,'ok');
                }catch(err){
                    notify(`Archivo corrupto o formato inválido: ${err.message}`,'err');
                }
            };
            reader.onerror=()=>notify('Error leyendo el archivo','err');
            reader.readAsArrayBuffer(file);
        };
        inp.click();
    }

    function exportDevueltas(){
        if(!workbookOriginal){ notify('Primero cargue un archivo','err'); return; }
        if(!devolutionSet.size){ notify('No hay guías marcadas','err'); return; }
        if(!confirm(`¿Exportar ${devolutionSet.size} filas marcadas?`)) return;
        const rows=XLSX.utils.sheet_to_json(worksheetOriginal,{header:1,defval:""});
        if(!rows.length) return;
        const hrow=rows[0];
        const gIdx=hrow.findIndex(h=>String(h).trim()==='Guía transportadora');
        if(gIdx<0){ alert("No se encontró columna 'Guía transportadora'"); return; }
        const out=[hrow,...rows.slice(1).filter(r=>devolutionSet.has(String(r[gIdx]??'').trim()))];
        const ws=XLSX.utils.aoa_to_sheet(out);
        if(worksheetOriginal['!cols']) ws['!cols']=[...worksheetOriginal['!cols']];
        if(worksheetOriginal['!merges']) ws['!merges']=[...worksheetOriginal['!merges']];
        const wb2=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb2,ws,sheetName);
        XLSX.writeFile(wb2,`devoluciones_${new Date().toISOString().slice(0,10)}.xlsx`);
        notify(`${devolutionSet.size} filas exportadas`,'ok');
    }

    function resetAll(){
        if(!originalRowsData.length) return;
        if(!confirm('¿Reiniciar todas las marcas?')) return;
        const previamenteMarcadas=[...devolutionSet];
        devolutionSet.clear(); addLog('SISTEMA','','','Admin','Todas','🔄 REINICIO');
        previamenteMarcadas.forEach(g=>updateRowStatus(g,false));
        lastScanCard.style.display='none';
        saveMarks(); updateStats(); guiaInput.focus();
        notify('Marcas reiniciadas','inf');
    }

    marcarBtn.addEventListener('click',()=>marcarGuia(guiaInput.value));
    guiaInput.addEventListener('keypress',e=>{ if(e.key==='Enter'){ e.preventDefault(); marcarGuia(guiaInput.value); } });
    limpiarBtn.addEventListener('click',()=>{ guiaInput.value=''; guiaInput.focus(); });
    loadFileBtn.addEventListener('click',loadExcelFile);
    exportBtn.addEventListener('click',exportDevueltas);
    resetBtn.addEventListener('click',resetAll);
    document.addEventListener('keydown',e=>{
        if(e.ctrlKey&&e.key==='k'){ e.preventDefault(); limpiarBtn.click(); }
        if(e.ctrlKey&&e.key==='e'){ e.preventDefault(); exportBtn.click(); }
    });

    loadLogs();
    guiaInput.focus();
