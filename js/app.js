// js/app.js

let currentTrades = [];
let activeFilter = 'all';
let calDate = new Date();
let tempConfig = {};
let editingTicket = null; // Biến theo dõi lệnh đang sửa

// 1. KHỞI CHẠY ỨNG DỤNG
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Ứng dụng đang khởi động...");
    if (typeof DataManager !== 'undefined') {
        // TẢI DỮ LIỆU TỪ GOOGLE SHEETS TRƯỚC KHI RENDER
        await DataManager.syncFromSheet(); 
        
        loadConfigToAnalysisForm(); 
        const savedData = DataManager.getData();
        if (Object.keys(savedData).length > 0) {
            currentTrades = Object.values(savedData);
            currentTrades.sort((a, b) => parseDate(b.time) - parseDate(a.time));
            handleFilterChange();
        } else {
            renderCalendar(calDate, []);
        }
    }
});

// 2. XỬ LÝ FILE UPLOAD
function handleFileUpload() {
    console.log("Bắt đầu đọc file...");
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert("Vui lòng chọn file HTML!");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const rawTrades = MT5Parser.parse(e.target.result);
            if (rawTrades.length === 0) {
                alert("Không tìm thấy lệnh nào hợp lệ. Hãy kiểm tra lại file Report (Dạng HTML).");
                return;
            }

            if (typeof DataManager !== 'undefined') {
                const combinedTrades = [...currentTrades, ...rawTrades];
                currentTrades = DataManager.mergeTrades(combinedTrades);
            } else {
                currentTrades = rawTrades;
            }

            currentTrades.sort((a, b) => parseDate(b.time) - parseDate(a.time));
            alert(`Đã nhập thành công! Tổng cộng: ${currentTrades.length} lệnh.`);
            
            handleFilterChange();

        } catch (error) {
            console.error(error);
            alert("Có lỗi xảy ra khi đọc file: " + error.message);
        }
    };
    reader.readAsText(file);
}

// 3. XỬ LÝ BỘ LỌC (FILTER)
function handleFilterChange() {
    const filterSelect = document.getElementById('dateFilter');
    const dateInput = document.getElementById('customDateInput');
    
    activeFilter = filterSelect ? filterSelect.value : 'all';

    if (activeFilter === 'specific_day') {
        dateInput.classList.remove('hidden');
        if (!dateInput.value) {
            dateInput.valueAsDate = new Date();
        }
    } else {
        dateInput.classList.add('hidden');
    }
    
    const visibleTrades = filterDataByDate(currentTrades, activeFilter);
    renderApp(visibleTrades);
}

function filterDataByDate(trades, filterType) {
    if (filterType === 'all') return trades;

    const now = new Date();
    now.setHours(23, 59, 59, 999);
    
    if (filterType === 'specific_day') {
        const inputVal = document.getElementById('customDateInput').value;
        if (!inputVal) return trades;
        
        const selectedDate = new Date(inputVal);
        selectedDate.setHours(0,0,0,0);

        return trades.filter(t => {
            const tradeDate = parseDate(t.time);
            return tradeDate.getDate() === selectedDate.getDate() &&
                   tradeDate.getMonth() === selectedDate.getMonth() &&
                   tradeDate.getFullYear() === selectedDate.getFullYear();
        });
    }

    return trades.filter(t => {
        const tradeDate = parseDate(t.time);
        switch (filterType) {
            case 'this_week': {
                const day = now.getDay(); 
                const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
                const monday = new Date(now);
                monday.setDate(diff);
                monday.setHours(0,0,0,0);
                return tradeDate >= monday;
            }
            case 'this_month':
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                return tradeDate >= startOfMonth;
            case 'last_month': {
                const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                return tradeDate >= startOfLastMonth && tradeDate <= endOfLastMonth;
            }
            case 'last_3_months': {
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(now.getMonth() - 3);
                return tradeDate >= threeMonthsAgo;
            }
            default:
                return true;
        }
    });
}

// 4. RENDER TỔNG THỂ
function renderApp(visibleTrades) {
    const countEl = document.getElementById('filteredCount');
    if (countEl) countEl.innerText = `${visibleTrades.length} lệnh`;

    renderStats(visibleTrades);
    renderTable(visibleTrades);
    renderCalendar(calDate, currentTrades);
    
    const config = DataManager.getConfig();

    if (typeof ChartManager !== 'undefined' && visibleTrades.length > 0) {
        const tradesForChart = [...visibleTrades].sort((a, b) => parseDate(a.time) - parseDate(b.time));
        
        const ctxEquity = document.getElementById('equityChart').getContext('2d');
        const ctxSystem = document.getElementById('systemChart').getContext('2d');
        const ctxTech = document.getElementById('techMistakeChart').getContext('2d');
        const ctxPsy = document.getElementById('psyMistakeChart').getContext('2d');
        const ctxSymbol = document.getElementById('symbolChart').getContext('2d');
        
        ChartManager.renderEquity(ctxEquity, tradesForChart, config.initialCapital);
        ChartManager.renderSystemStats(ctxSystem, visibleTrades);
        ChartManager.renderMistakes(ctxTech, visibleTrades, 'mistakeTech');
        ChartManager.renderMistakes(ctxPsy, visibleTrades, 'mistakePsy');
        ChartManager.renderSymbolGrowth(ctxSymbol, tradesForChart);
    }
}

// 5. RENDER THỐNG KÊ (DASHBOARD)
function renderStats(trades) {
    let totalProfit = 0;
    let wins = 0;
    
    trades.forEach(t => {
        totalProfit += t.profit;
        if (t.profit > 0) wins++;
    });

    const elTotal = document.getElementById('statTotalTrades');
    const elWinrate = document.getElementById('statWinrate');
    const elProfit = document.getElementById('statProfit');

    if(elTotal) elTotal.innerText = trades.length;
    if(elWinrate) elWinrate.innerText = trades.length ? ((wins/trades.length)*100).toFixed(1) + '%' : '0%';
    
    if(elProfit) {
        elProfit.innerText = totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' $';
        elProfit.className = `text-2xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`;
    }
}

// 6. RENDER BẢNG LỆNH (SIDEBAR)
function renderTable(trades) {
    const tbody = document.getElementById('tradeTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    trades.forEach(t => {
        if (!t.analysis) {
            t.analysis = { setup: "", mistakeTech: "", mistakePsy: "", emotion: "", note: "", reviewed: false };
        }

        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-700 hover:bg-slate-700 cursor-pointer transition group animate-fade-in";
        tr.onclick = () => openEditModal(t.ticket);

        const hasNote = t.analysis.note && t.analysis.note.trim() !== "";
        const statusIcon = hasNote
            ? "<span class='text-green-500 font-bold'>✔</span>"
            : "<span class='text-gray-600 group-hover:text-yellow-500 transition'>⭕</span>";

        const profitClass = t.profit >= 0 ? 'text-green-400' : 'text-red-400';
        const profitSign = t.profit > 0 ? '+' : '';

        tr.innerHTML = `
            <td class="px-4 py-3 text-gray-400 text-xs font-mono">${t.time}</td>
            <td class="px-4 py-3 font-bold text-gray-200 text-sm">
                ${t.symbol}
                <div class="text-xs font-normal text-gray-500">Vol: ${t.size}</div>
            </td>
            <td class="px-4 py-3">
                <span class="${t.type === 'buy' ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-red-900/50 text-red-300 border border-red-700'} px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                    ${t.type}
                </span>
            </td>
            <td class="px-4 py-3 text-right font-mono font-bold ${profitClass}">
                ${profitSign}${t.profit}
            </td>
            <td class="px-4 py-3 text-center text-xs">${statusIcon}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 7. LỊCH PNL (CALENDAR)
function changeCalendarMonth(offset) {
    calDate.setMonth(calDate.getMonth() + offset);
    renderCalendar(calDate, currentTrades);
}

function renderCalendar(date, trades) {
    const grid = document.getElementById('calendarGrid');
    const title = document.getElementById('calendarTitle');
    if(!grid || !title) return;

    grid.innerHTML = '';
    
    const year = date.getFullYear();
    const month = date.getMonth(); 
    
    title.innerText = `THÁNG ${month + 1} / ${year}`;

    const dailyData = {};
    trades.forEach(t => {
        const d = parseDate(t.time);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!dailyData[key]) dailyData[key] = { profit: 0, count: 0 };
        dailyData[key].profit += t.profit;
        dailyData[key].count += 1;
    });

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDayOfMonth; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = "bg-slate-800/50 aspect-square"; 
        grid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        const key = `${year}-${month}-${day}`;
        const data = dailyData[key];

        let bgClass = "bg-slate-900 hover:bg-slate-800";
        let textHTML = "";

        if (data) {
            const p = data.profit;
            const profitColor = p >= 0 ? 'text-emerald-400' : 'text-rose-400';
            const profitValue = parseFloat(p.toFixed(2));
            const fontSize = Math.abs(profitValue) > 999 ? 'text-[10px]' : 'text-xs';
            bgClass = p >= 0 ? "bg-emerald-900/40 hover:bg-emerald-900/60" : "bg-rose-900/40 hover:bg-rose-900/60";

            textHTML = `
                <div class="flex flex-col items-center justify-center h-full">
                    <span class="${profitColor} font-bold ${fontSize} tracking-tighter leading-tight">
                        ${p > 0 ? '+' : ''}${profitValue}
                    </span>
                    <span class="text-[9px] text-gray-500 font-mono mt-0.5">${data.count} lệnh</span>
                </div>
            `;
        }

        cell.className = `aspect-square p-1 flex flex-col justify-between cursor-pointer transition relative group border border-slate-700/50 ${bgClass}`;
        
        const dateColor = data ? "text-gray-300 group-hover:text-white" : "text-gray-600";
        cell.innerHTML = `<div class="${dateColor} text-[10px] font-bold pl-1 pt-1">${day}</div>${textHTML}<div class="h-1"></div>`;
        
        if(data) {
             cell.onclick = () => {
                 const dateString = `${year}-${String(month+1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                 document.getElementById('dateFilter').value = 'specific_day';
                 const cInput = document.getElementById('customDateInput');
                 cInput.classList.remove('hidden');
                 cInput.value = dateString;
                 handleFilterChange();
                 window.scrollTo({ top: 0, behavior: 'smooth' });
             }
        }
        grid.appendChild(cell);
    }
}

// 8. LOGIC MODAL TU LUYỆN (EDIT TRADE)
function openEditModal(ticketId) {
    editingTicket = ticketId;
    const trade = currentTrades.find(t => t.ticket === ticketId);
    if(!trade) return;

    const modalTitle = document.getElementById('modalTitle');
    if(modalTitle) modalTitle.innerHTML = `Tu Luyện: <span class="text-yellow-400">${trade.symbol}</span> <span class="text-sm text-gray-400">#${trade.ticket}</span>`;
    
    loadConfigToAnalysisForm();

    const setValue = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ""; };

    if(trade.analysis) {
        setValue('inputSetup', trade.analysis.setup);
        setValue('inputMistakeTech', trade.analysis.mistakeTech);
        setValue('inputMistakePsy', trade.analysis.mistakePsy);
        setValue('inputEmotion', trade.analysis.emotion);
        setValue('inputNote', trade.analysis.note);
    }
    
    updateSetupDescription();

    const modal = document.getElementById('editModal');
    if(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    editingTicket = null;
}

function saveTradeAnalysis() {
    if(!editingTicket) {
        closeEditModal();
        return;
    }

    const getValue = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };

    const analysisData = {
        setup: getValue('inputSetup'),
        mistakeTech: getValue('inputMistakeTech'),
        mistakePsy: getValue('inputMistakePsy'),
        emotion: getValue('inputEmotion'),
        note: getValue('inputNote'),
        rating: 3 
    };

    if (typeof DataManager !== 'undefined') {
        DataManager.updateAnalysis(editingTicket, analysisData);
    }
    
    const index = currentTrades.findIndex(t => t.ticket === editingTicket);
    if(index !== -1) currentTrades[index].analysis = analysisData;

    handleFilterChange();
    closeEditModal();
}

function updateSetupDescription() {
    const setupName = document.getElementById('inputSetup').value;
    const descEl = document.getElementById('setupDescription');
    const config = DataManager.getConfig();
    
    const found = config.setups.find(s => s.name === setupName);
    if (found && found.content) {
        descEl.innerHTML = found.content.replace(/\n/g, '<br>');
    } else {
        descEl.innerHTML = "<span class='text-gray-500'>Không có mô tả.</span>";
    }
}

// 9. LOGIC MODAL CÀI ĐẶT (SETTINGS)
function openSettingsModal() {
    tempConfig = DataManager.getConfig();
    document.getElementById('settingCapital').value = tempConfig.initialCapital || 0;
    
    renderSettingsSetupList();
    renderSettingsMistakeList('Tech');
    renderSettingsMistakeList('Psy');

    const modal = document.getElementById('settingsModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function renderSettingsSetupList() {
    const container = document.getElementById('settingsSetupList');
    container.innerHTML = '';
    
    tempConfig.setups.forEach((setup, index) => {
        const div = document.createElement('div');
        div.className = "bg-slate-900 p-3 rounded border border-slate-700 flex flex-col gap-2 animate-fade-in";
        div.innerHTML = `
            <div class="flex gap-2">
                <input type="text" placeholder="Tên Phương Pháp" value="${setup.name}" onchange="updateSetupData(${index}, 'name', this.value)"
                    class="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-yellow-400 font-bold w-1/3 focus:border-blue-500 outline-none">
                <button onclick="removeSetup(${index})" class="text-red-500 hover:text-red-400 font-bold px-2 ml-auto">🗑</button>
            </div>
            <textarea placeholder="Mô tả / Quy tắc..." onchange="updateSetupData(${index}, 'content', this.value)"
                class="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-gray-300 text-sm w-full h-16 focus:border-blue-500 outline-none resize-none">${setup.content}</textarea>
        `;
        container.appendChild(div);
    });
}

function renderSettingsMistakeList(type) {
    const container = document.getElementById(`settingsMistake${type}List`);
    const list = type === 'Tech' ? tempConfig.mistakesTech : tempConfig.mistakesPsy;
    
    container.innerHTML = '';
    list.forEach((mistake, index) => {
        const div = document.createElement('div');
        div.className = "flex items-center gap-2 animate-fade-in";
        div.innerHTML = `
            <input type="text" value="${mistake}" onchange="updateMistakeData('${type}', ${index}, this.value)"
                class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white w-full focus:border-red-500 outline-none">
            <button onclick="removeMistake('${type}', ${index})" class="text-red-500 hover:text-red-400">🗑</button>
        `;
        container.appendChild(div);
    });
}

// Helper functions cho Settings
function addSetupRow() {
    tempConfig.setups.push({ name: "Phương pháp mới", content: "" });
    renderSettingsSetupList();
}

function removeSetup(index) {
    if(confirm("Xóa phương pháp này?")) {
        tempConfig.setups.splice(index, 1);
        renderSettingsSetupList();
    }
}

function updateSetupData(index, field, value) {
    tempConfig.setups[index][field] = value;
}

function addMistakeRow(type) {
    const list = type === 'Tech' ? tempConfig.mistakesTech : tempConfig.mistakesPsy;
    list.push("Lỗi mới...");
    renderSettingsMistakeList(type);
}

function removeMistake(type, index) {
    const list = type === 'Tech' ? tempConfig.mistakesTech : tempConfig.mistakesPsy;
    list.splice(index, 1);
    renderSettingsMistakeList(type);
}

function updateMistakeData(type, index, value) {
    const list = type === 'Tech' ? tempConfig.mistakesTech : tempConfig.mistakesPsy;
    list[index] = value;
}

function saveSettings() {
    tempConfig.initialCapital = parseFloat(document.getElementById('settingCapital').value) || 0;
    DataManager.saveConfig(tempConfig);
    alert("Đã lưu cài đặt!");
    closeSettingsModal();
    loadConfigToAnalysisForm();
    handleFilterChange();
}

// 10. THÊM LỆNH THỦ CÔNG & RESET DỮ LIỆU
function openManualTradeModal() {
    document.getElementById('newTicket').value = '';
    document.getElementById('newSymbol').value = '';
    document.getElementById('newSize').value = '0.01';
    document.getElementById('newProfit').value = '0';
    document.getElementById('newNote').value = '';
    
    const modal = document.getElementById('manualTradeModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeManualTradeModal() {
    const modal = document.getElementById('manualTradeModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function saveManualTrade() {
    const ticket = document.getElementById('newTicket').value;
    const symbol = document.getElementById('newSymbol').value.toUpperCase();
    const type = document.getElementById('newType').value;
    const size = parseFloat(document.getElementById('newSize').value) || 0.01;
    const profit = parseFloat(document.getElementById('newProfit').value) || 0;
    const note = document.getElementById('newNote').value;

    if (!ticket || !symbol) {
        alert("Vui lòng nhập Ticket ID và Cặp tiền!");
        return;
    }

    const config = DataManager.getConfig();

    const defaultSetup = (
        config.setups.find(s => s.name === "Chưa xác định") ||
        (config.setups.length > 0 ? config.setups[0] : {name: "Chưa xác định"})
    ).name;
    
    const newTrade = {
        ticket: ticket,
        time: new Date().toISOString().replace('T', ' ').slice(0, 19).replace(/-/g, '.'),
        type: type,
        symbol: symbol,
        size: size,
        price: 0, 
        sl: 0,
        tp: 0,
        profit: profit,
        analysis: {
            setup: defaultSetup,
            mistakeTech: config.mistakesTech[0] || "Không có lỗi",
            mistakePsy: config.mistakesPsy[0] || "Tâm lý ổn định",
            emotion: "😐 Bình thường",
            note: note,
            rating: 3,
            reviewed: note.trim() !== ""
        }
    };

    if (typeof DataManager !== 'undefined') {
        const updatedList = DataManager.mergeTrades([newTrade]);
        currentTrades = updatedList;
        currentTrades.sort((a, b) => parseDate(b.time) - parseDate(a.time));
        handleFilterChange();
        alert("Đã thêm lệnh thành công!");
        closeManualTradeModal();
    }
}

function actionClearTrades() {
    if (confirm("CẢNH BÁO: Bạn có chắc muốn xóa toàn bộ lịch sử lệnh?\n\nHành động này KHÔNG THỂ khôi phục!")) {
        if (typeof DataManager !== 'undefined') {
            DataManager.clearTrades();
            alert("Đã xóa dữ liệu lệnh thành công!");
            location.reload();
        }
    }
}

function actionFactoryReset() {
    const code = prompt("Nhập chữ 'RESET' để xác nhận xóa toàn bộ (Lệnh + Cấu hình Setup/Lỗi):");
    if (code === 'RESET') {
        if (typeof DataManager !== 'undefined') {
            DataManager.factoryReset();
            alert("App đã được khôi phục về trạng thái ban đầu!");
            location.reload();
        }
    }
}

// 11. TIỆN ÍCH (HELPER)
function loadConfigToAnalysisForm() {
    if (typeof DataManager === 'undefined') return;
    const config = DataManager.getConfig();
    
    const fillSelect = (id, list, isObjectList = false) => {
        const select = document.getElementById(id);
        if(!select) return;
        const currentVal = select.value;
        
        select.innerHTML = list.map(item => {
            const val = typeof item === 'object' ? item.name : item;
            return `<option value="${val}">${val}</option>`;
        }).join('');
        
        if (currentVal) {
            const exists = list.some(item => (typeof item === 'object' ? item.name : item) === currentVal);
            if(exists) select.value = currentVal;
        }
    };

    fillSelect('inputSetup', config.setups, true);
    fillSelect('inputMistakeTech', config.mistakesTech);
    fillSelect('inputMistakePsy', config.mistakesPsy);
    
    const emotions = ["😐 Bình thường", "🧘 Bình an / Tự tin", "😡 Cay cú / Bực bội", "😨 Sợ hãi / Lo lắng", "🤩 Hưng phấn quá độ", "😩 Mệt mỏi"];
    fillSelect('inputEmotion', emotions);
}

function parseDate(dateStr) {
    if (!dateStr) return new Date();
    return new Date(dateStr.replace(/\./g, '/'));
}