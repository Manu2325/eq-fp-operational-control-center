let currentSection = 'daily';
let activeDirectory = new Set();

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    await loadDirectoryData();
    switchSection('daily');
}

function cleanId(id) {
    return (id || '').toString().trim();
}

async function loadDirectoryData() {
    try {
        const masterId = cleanId(CONFIG.MASTER_SPREADSHEET_ID);
        const apiKey = cleanId(CONFIG.API_KEY);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${masterId}/values/${encodeURIComponent('Directory')}!A2:A100?key=${apiKey}`;
        
        const res = await fetch(url);
        if (!res.ok) return;

        const json = await res.json();
        if (json.values) {
            activeDirectory.clear();
            json.values.forEach(row => {
                if (row[0] && row[0].toString().trim() !== '') {
                    activeDirectory.add(row[0].toString().trim().toUpperCase());
                }
            });
        }
    } catch (err) {
        console.warn('Error al cargar Directory:', err);
    }
}

async function switchSection(section) {
    currentSection = section;

    const tabs = ['daily', 'weekly', 'mtd', 'productivity', 'commissions', 'call-review', 'call-summary', 'adherence', 'directory'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (btn) {
            if (t === section) {
                btn.className = "px-4 py-2 text-xs font-bold bg-amber-500/10 text-amber-400 border-b-2 border-amber-400 rounded-t-lg backdrop-blur-sm transition-all";
            } else {
                btn.className = "px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-t-lg transition-all";
            }
        }
    });

    if (['daily', 'weekly', 'mtd'].includes(section)) {
        await loadPeriodData(section);
    } else {
        await loadMasterSheetTab(section);
    }
}

async function loadPeriodData(period) {
    const container = document.getElementById('sheet-view-container');
    const loading = document.getElementById('loading');
    
    if (container) container.innerHTML = '';
    if (loading) loading.classList.remove('hidden');

    try {
        const results = [];
        let totalActiveAgents = 0;

        for (let i = 0; i < CONFIG.SERVICES.length; i++) {
            const service = CONFIG.SERVICES[i];
            const { rows: rawRows, sheetTitle } = await fetchServiceTab(service.spreadsheetId, period);
            const filteredRows = filterActiveAgents(rawRows);

            if (i === 0 && filteredRows) {
                totalActiveAgents = countAgents(filteredRows);
            }

            if (filteredRows && filteredRows.length > 0) {
                results.push({
                    name: service.name,
                    sheetTitle: sheetTitle ? ` — [${sheetTitle}]` : '',
                    rows: filteredRows
                });
            }
        }

        if (results.length === 0) {
            container.innerHTML = `<div class="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-center text-xs">No hay registros disponibles para la sección seleccionada.</div>`;
        } else {
            renderConsolidatedView(results, totalActiveAgents);
        }
    } catch (err) {
        if (container) {
            container.innerHTML = `<div class="bg-rose-950/40 border border-rose-800/50 text-rose-300 p-4 rounded-xl text-xs">Error: ${err.message}</div>`;
        }
    } finally {
        if (loading) loading.classList.add('hidden');
    }
}

async function fetchServiceTab(spreadsheetId, period) {
    const id = cleanId(spreadsheetId);
    const apiKey = cleanId(CONFIG.API_KEY);

    try {
        const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties&key=${apiKey}`;
        const metaRes = await fetch(metadataUrl);

        if (!metaRes.ok) return { rows: [], sheetTitle: '' };

        const metaData = await metaRes.json();
        if (!metaData.sheets || metaData.sheets.length === 0) return { rows: [], sheetTitle: '' };

        const visibleSheets = metaData.sheets.filter(s => !s.properties.hidden);
        if (visibleSheets.length === 0) return { rows: [], sheetTitle: '' };

        let targetTitle = '';

        if (period === 'daily') {
            targetTitle = visibleSheets[visibleSheets.length - 1].properties.title;
        } else if (period === 'weekly') {
            const idx = Math.min(3, visibleSheets.length - 1);
            targetTitle = visibleSheets[idx].properties.title;
        } else if (period === 'mtd') {
            const idx = Math.min(1, visibleSheets.length - 1);
            targetTitle = visibleSheets[idx].properties.title;
        }

        const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/'${encodeURIComponent(targetTitle)}'!A1:AK37?key=${apiKey}`;
        const dataRes = await fetch(dataUrl);

        if (!dataRes.ok) return { rows: [], sheetTitle: targetTitle };

        const dataJson = await dataRes.json();
        return {
            rows: dataJson.values || [],
            sheetTitle: targetTitle
        };
    } catch (e) {
        console.error('Error en fetchServiceTab:', e);
        return { rows: [], sheetTitle: '' };
    }
}

function filterActiveAgents(rows) {
    if (!rows || rows.length === 0) return [];
    return rows.slice(0, 37);
}

function countAgents(rows) {
    if (!rows || rows.length <= 1) return 0;
    let count = 0;
    for (let i = 1; i < rows.length; i++) {
        const name = (rows[i][0] || '').toString().trim();
        if (name && !name.toLowerCase().includes('total') && !name.toLowerCase().includes('grand total')) count++;
    }
    return count;
}

// Render para Daily, Weekly y MTD
function renderConsolidatedView(campaignsData, totalAgents) {
    const kpiEl = document.getElementById('kpi-total-agents');
    if (kpiEl) kpiEl.textContent = totalAgents;

    const container = document.getElementById('sheet-view-container');
    if (!container) return;
    container.innerHTML = '';

    campaignsData.forEach(c => {
        if (!c.rows || c.rows.length === 0) return;

        const tableCard = document.createElement('div');
        tableCard.className = "bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden";

        const header = c.rows[0];
        const bodyRows = c.rows.slice(1);
        const headerTitle = `${c.name}${c.sheetTitle || ''}`;

        let tableHtml = `
            <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 px-6 py-3 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-amber-400"></div>
                    <span class="text-xs font-bold text-amber-400 uppercase tracking-widest">${headerTitle}</span>
                </div>
            </div>
            <div class="custom-scroll overflow-x-auto">
                <table class="w-full text-xs text-left border-collapse">
                    <thead class="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                        <tr>${header.map(h => `<th class="p-3 border-r border-slate-800/60 text-center">${h || ''}</th>`).join('')}</tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/40">
        `;

        bodyRows.forEach(row => {
            const firstCell = (row[0] || '').toString().toLowerCase();
            const isTotal = firstCell.includes('total') || firstCell.includes('grand total');
            const rowClass = isTotal ? 'font-bold bg-slate-800/70 text-amber-300 border-t-2 border-slate-700' : 'hover:bg-slate-800/30 transition-colors text-slate-200';

            tableHtml += `<tr class="${rowClass}">`;
            row.forEach((cell, colIdx) => {
                const alignClass = colIdx === 0 ? 'text-left font-semibold' : 'text-right';
                // Dentro del loop de filas de renderConsolidatedView:
                const conditionalStyle = isTotal ? '' : getConditionalFormatting(cell, colIdx, header, c.name);
                
                tableHtml += `<td class="p-3 border-r border-slate-800/40 ${alignClass}" style="${conditionalStyle}">${cell !== undefined ? cell : ''}</td>`;
            });
            tableHtml += `</tr>`;
        });

        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;

        tableCard.innerHTML = tableHtml;
        container.appendChild(tableCard);
    });
}

function getConditionalFormatting(val, colIdx, headerRow, campaignName = '') {
    if (!val || colIdx === 0) return '';

    const colName = (headerRow[colIdx] || '').toString().toUpperCase();
    const cleanVal = parseFloat(val.toString().replace(/[%$,]/g, '').trim());

    if (isNaN(cleanVal)) return '';

    // Productividad, Conversión y RPC Rate
    if (colName.includes('PRODUCTIVITY') || colName.includes('CONVERSION') || colName.includes('RPC RATE')) {
        if (cleanVal >= 70) {
            return 'background-color: rgba(16, 185, 129, 0.18); color: #34d399; font-weight: 700;';
        } else if (cleanVal >= 50) {
            return 'background-color: rgba(245, 158, 11, 0.18); color: #fbbf24; font-weight: 700;';
        } else {
            return 'background-color: rgba(239, 68, 68, 0.18); color: #f87171; font-weight: 700;';
        }
    }

    // Wrap Up Time
    if (colName.includes('WRAP')) {
        if (cleanVal <= 25) {
            return 'background-color: rgba(16, 185, 129, 0.18); color: #34d399; font-weight: 700;';
        } else if (cleanVal <= 35) {
            return 'background-color: rgba(245, 158, 11, 0.18); color: #fbbf24; font-weight: 700;';
        } else {
            return 'background-color: rgba(239, 68, 68, 0.18); color: #f87171; font-weight: 700;';
        }
    }

    // Promises Per Hour (PPH) según LOB
    if (colName.includes('PROMISES') || colName.includes('PPH')) {
        const campaignUpper = campaignName.toUpperCase();
        const isCRC = campaignUpper.includes('CRC_QC') && !campaignUpper.includes('CRCC');

        if (isCRC) {
            // Parámetros para CRC_QC (Comcast Equipment)
            if (cleanVal >= 5.0) {
                return 'background-color: rgba(16, 185, 129, 0.18); color: #34d399; font-weight: 700;';
            } else if (cleanVal >= 3.0) {
                return 'background-color: rgba(245, 158, 11, 0.18); color: #fbbf24; font-weight: 700;';
            } else {
                return 'background-color: rgba(239, 68, 68, 0.18); color: #f87171; font-weight: 700;';
            }
        } else {
            // Parámetros para las otras LOBs (CRCC_QC, Earthlink_QC, Optimum_QC)
            if (cleanVal >= 2.0) {
                return 'background-color: rgba(16, 185, 129, 0.18); color: #34d399; font-weight: 700;'; // Verde (> 2)
            } else if (cleanVal >= 1.0) {
                return 'background-color: rgba(245, 158, 11, 0.18); color: #fbbf24; font-weight: 700;'; // Amarillo (1.0 a 1.9)
            } else {
                return 'background-color: rgba(239, 68, 68, 0.18); color: #f87171; font-weight: 700;'; // Rojo (< 0.9 / < 1.0)
            }
        }
    }

    return '';
}

function getCssColor(colorObj, defaultColor = '') {
    if (!colorObj) return defaultColor;
    const rgb = colorObj.rgbColor || colorObj;
    if (rgb.red === undefined && rgb.green === undefined && rgb.blue === undefined) {
        return defaultColor;
    }
    const r = Math.round((rgb.red || 0) * 255);
    const g = Math.round((rgb.green || 0) * 255);
    const b = Math.round((rgb.blue || 0) * 255);
    return `rgb(${r}, ${g}, ${b})`;
}

// Cargar Pestañas Maestras
async function loadMasterSheetTab(sectionKey) {
    const tabMap = {
        'productivity': 'Productivity',
        'commissions': 'Commissions',
        'call-review': 'Call audit Review',
        'call-summary': 'Call Audit Summary',
        'adherence': 'Adherence/AW Call Avoidance',
        'directory': 'Directory'
    };

    const targetKeyword = tabMap[sectionKey];
    if (!targetKeyword) return;

    const container = document.getElementById('sheet-view-container');
    const loading = document.getElementById('loading');
    
    if (container) container.innerHTML = '';
    if (loading) loading.classList.remove('hidden');

    try {
        const masterId = cleanId(CONFIG.MASTER_SPREADSHEET_ID);
        const apiKey = cleanId(CONFIG.API_KEY);

        const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${masterId}?fields=sheets.properties.title&key=${apiKey}`;
        const metaRes = await fetch(metaUrl);
        if (!metaRes.ok) throw new Error(`Status ${metaRes.status}: Error al conectar con la Hoja Maestra.`);

        const metaData = await metaRes.json();
        const allSheetTitles = (metaData.sheets || []).map(s => s.properties.title);

        let targetTabName = allSheetTitles.find(title => 
            title.toLowerCase().trim() === targetKeyword.toLowerCase().trim()
        );

        if (!targetTabName && sectionKey === 'commissions') {
            targetTabName = allSheetTitles.find(title => title.toLowerCase().includes('commissions'));
        }

        if (!targetTabName) {
            throw new Error(`No se encontró ninguna pestaña que coincida con "${targetKeyword}" en el Libro Maestro.`);
        }

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${masterId}?ranges=${encodeURIComponent(targetTabName)}!A1:AK100&includeGridData=true&key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Status ${res.status}: Revisa que la pestaña "${targetTabName}" esté accesible.`);
        
        const json = await res.json();
        const sheetData = json.sheets?.[0]?.data?.[0]?.rowData;

        if (!sheetData || sheetData.length === 0) {
            container.innerHTML = `<div class="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-center text-xs">Sin información disponible en "${targetTabName}".</div>`;
            return;
        }

        renderMasterTableWithStyles(targetTabName, sheetData);
    } catch (err) {
        if (container) {
            container.innerHTML = `<div class="bg-rose-950/40 border border-rose-800/50 text-rose-300 p-4 rounded-xl text-xs">Error al cargar la pestaña: ${err.message}</div>`;
        }
    } finally {
        if (loading) loading.classList.add('hidden');
    }
}

function renderMasterTableWithStyles(title, rowData) {
    const container = document.getElementById('sheet-view-container');
    if (!container) return;

    // Detectamos si es Commissions para forzar ajuste responsivo en un solo cuadro
    const isCommissions = title.toLowerCase().includes('commissions');
    
    // Si es commissions, usamos table-fixed para forzar que quepa en pantalla sin scroll
    const tableLayoutClass = isCommissions ? 'table-fixed w-full' : 'w-full';
    const textSize = isCommissions ? 'text-[10px]' : 'text-xs';
    const cellPadding = isCommissions ? 'px-1 py-1.5' : 'p-3';

    const tableCard = document.createElement('div');
    tableCard.className = "bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col";

    let html = `
        <div class="bg-slate-900 border-b border-slate-800 px-6 py-2.5 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-amber-400"></div>
                <span class="text-xs font-bold text-amber-400 uppercase tracking-widest">${title}</span>
            </div>
            ${!isCommissions ? `
            <span class="text-[10px] text-slate-400 font-medium bg-slate-800/80 px-3 py-0.5 rounded-full border border-slate-700">
                ← Desliza horizontalmente →
            </span>` : ''}
        </div>
        
        <div class="${isCommissions ? 'w-full overflow-hidden' : 'custom-scroll overflow-x-auto'}">
            <table class="${tableLayoutClass} ${textSize} text-left border-collapse">
                <tbody class="divide-y divide-slate-800/50">
    `;

    rowData.forEach((row, rowIndex) => {
        const cells = row.values || [];
        if (cells.length === 0 || cells.every(c => !c.formattedValue)) return;

        const isHeader = rowIndex === 0;
        const tag = isHeader ? 'th' : 'td';
        const rowClass = isHeader 
            ? 'bg-slate-950/95 font-bold border-b border-slate-800 uppercase tracking-wider sticky top-0 z-20' 
            : 'hover:bg-slate-800/40 transition-colors';

        html += `<tr class="${rowClass}">`;

        cells.forEach((cell, colIdx) => {
            const val = cell.formattedValue !== undefined ? cell.formattedValue : '';
            const fmt = cell.effectiveFormat || {};
            
            const bgRgb = fmt.backgroundColor || {};
            const r = Math.round((bgRgb.red || 0) * 255);
            const g = Math.round((bgRgb.green || 0) * 255);
            const b = Math.round((bgRgb.blue || 0) * 255);
            
            const hasCustomBg = bgRgb.red !== undefined || bgRgb.green !== undefined || bgRgb.blue !== undefined;
            const isPureWhite = r > 240 && g > 240 && b > 240;

            let styleAttr = '';

            // En Commissions permitimos que los textos largos rompan en varias líneas para ajustar el ancho
            let wrapClass = '';
            if (isCommissions) {
                wrapClass = 'whitespace-normal break-words text-center leading-tight';
            } else {
                const isNoteCol = val.length > 50 || (rowData[0]?.values?.[colIdx]?.formattedValue || '').toUpperCase().includes('NOTE');
                wrapClass = isNoteCol ? 'whitespace-normal break-words max-w-md min-w-[280px]' : 'whitespace-nowrap min-w-[120px]';
            }

            if (hasCustomBg && !isPureWhite) {
                styleAttr += `background-color: rgb(${r}, ${g}, ${b}); `;
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                styleAttr += brightness > 128 ? 'color: #0f172a; font-weight: 600; ' : 'color: #ffffff; font-weight: 600; ';
            } else {
                styleAttr += 'color: #f8fafc; ';
            }

            if (fmt.textFormat?.bold) {
                styleAttr += 'font-weight: 700; ';
            }

            let content = val;
            if (cell.hyperlink) {
                content = `<a href="${cell.hyperlink}" target="_blank" class="text-sky-400 underline hover:text-sky-300 font-medium">${val}</a>`;
            }

            html += `<${tag} class="${cellPadding} border-r border-slate-800/50 align-top ${wrapClass}" style="${styleAttr}">${content}</${tag}>`;
        });

        html += `</tr>`;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    tableCard.innerHTML = html;
    container.appendChild(tableCard);
}

function refreshCurrentView() {
    switchSection(currentSection);
}