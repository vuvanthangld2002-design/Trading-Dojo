// js/data_manager.js
const DataManager = {
    storageKeyData: 'trading_dojo_data',
    storageKeyConfig: 'trading_dojo_config',

    // ĐÓNG VAI TRÒ CẦU NỐI: LINK API GOOGLE SHEETS CỦA ANH
    API_URL: 'https://script.google.com/macros/s/AKfycby6CWWkRlZeRd0m2A35dOjYbL2sXdnEMjyYZv5g56Txjxew2qbWzsizxKokjWR5T-8j/exec', 

    // --- 0. ĐỒNG BỘ TỪ GOOGLE SHEETS VỀ (GỌI KHI MỞ WEB) ---
    syncFromSheet: async function() {
        try {
            console.log("Đang tải dữ liệu từ Google Sheets...");
            const response = await fetch(this.API_URL);
            const result = await response.json();
            
            if (result.success) {
                if (result.config) localStorage.setItem(this.storageKeyConfig, JSON.stringify(result.config));
                if (result.trades && Object.keys(result.trades).length > 0) {
                    localStorage.setItem(this.storageKeyData, JSON.stringify(result.trades));
                }
                console.log("Đồng bộ từ Sheets thành công!");
            }
        } catch (e) {
            console.error("Lỗi khi tải dữ liệu từ Sheet:", e);
        }
    },

    // --- 1. QUẢN LÝ DỮ LIỆU LỆNH (TRADES) ---
    getData: function() {
        const data = localStorage.getItem(this.storageKeyData);
        if (!data) return {};
        const parsed = JSON.parse(data);
        // migration for older entries: make sure analysis.reviewed exists
        Object.values(parsed).forEach(t => {
            if (t.analysis && t.analysis.reviewed === undefined) {
                const note = t.analysis.note || "";
                const setup = t.analysis.setup || "";
                t.analysis.reviewed = note.trim() !== "" || (setup && setup !== "Chưa xác định");
            }
        });
        return parsed;
    },

    saveData: function(data) {
        localStorage.setItem(this.storageKeyData, JSON.stringify(data));
        // LƯU LÊN SHEET NGẦM
        fetch(this.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "saveTrades", data: data }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        }).catch(err => console.error("Lỗi lưu Trades lên Sheet", err));
    },

    // Hàm trộn dữ liệu từ file mới vào dữ liệu cũ
    mergeTrades: function(newTrades) {
        let currentData = this.getData();
        const config = this.getConfig();

        // migration: ensure all existing analyses have a reviewed flag
        Object.values(currentData).forEach(t => {
            if (t.analysis && t.analysis.reviewed === undefined) {
                const note = t.analysis.note || "";
                t.analysis.reviewed = note.trim() !== "";
            }
        });

        let mergedList = newTrades.map(trade => {
            const id = trade.ticket;
            if (currentData[id]) {
                return { ...trade, analysis: currentData[id].analysis };
            } else {
                // Tạo mới nếu chưa có
                const defaultSetup = (
                    config.setups.find(s => s.name === "Chưa xác định") ||
                    (config.setups.length > 0 ? config.setups[0] : {name: "Chưa xác định"})
                ).name;
                return {
                    ...trade,
                    analysis: {
                        setup: defaultSetup,
                        mistakeTech: config.mistakesTech && config.mistakesTech.length > 0 ? config.mistakesTech[0] : "Không có lỗi",
                        mistakePsy: config.mistakesPsy && config.mistakesPsy.length > 0 ? config.mistakesPsy[0] : "Tâm lý ổn định",
                        emotion: "😐 Bình thường",
                        rating: 3,
                        note: "",
                        reviewed: false
                    }
                };
            }
        });

        let dataToSave = {};
        mergedList.forEach(t => dataToSave[t.ticket] = t);
        this.saveData(dataToSave);
        return mergedList;
    },

    // Cập nhật phân tích cho 1 lệnh
    updateAnalysis: function(ticketId, analysisData) {
        let currentData = this.getData();
        if (currentData[ticketId]) {
            analysisData.reviewed = (analysisData.note || "").trim() !== "";
            currentData[ticketId].analysis = analysisData;
            this.saveData(currentData);
        }
    },

    // --- 2. QUẢN LÝ CẤU HÌNH (CONFIG) ---
    getConfig: function() {
        const config = localStorage.getItem(this.storageKeyConfig);
        if (config) {
            let parsed = JSON.parse(config);
            if (!parsed.mistakesTech) {
                parsed.mistakesTech = ["Không có lỗi (Tuân thủ tốt)", "Vào lệnh sớm", "Ngược xu hướng", "SL quá ngắn"];
            }
            if (!parsed.mistakesPsy) {
                parsed.mistakesPsy = ["Tâm lý ổn định", "Fomo", "Sợ hãi", "Tham lam", "Trả thù thị trường"];
            }
            return parsed;
        }
        
        return {
            initialCapital: 1000,
            setups: [
                { name: "Chưa xác định", content: "Chưa phân loại." },
                { name: "SMC - Order Block", content: "Đánh theo OB tại vùng Supply/Demand." },
                { name: "Price Action", content: "Pinbar, Engulfing..." }
            ],
            mistakesTech: [
                "Không có lỗi (Tuân thủ tốt)",
                "Vào lệnh sớm (Chưa đóng nến)",
                "Ngược xu hướng lớn",
                "Stoploss quá ngắn",
                "Điểm vào lệnh xấu (R:R thấp)"
            ],
            mistakesPsy: [
                "Tâm lý ổn định",
                "Fomo - Sợ lỡ cơ hội",
                "Sợ hãi - Cắt lỗ sớm",
                "Tham lam - Không chốt lời",
                "Trả thù thị trường (Revenge)",
                "Gồng lỗ (Dời SL)"
            ]
        };
    },

    saveConfig: function(newConfig) {
        localStorage.setItem(this.storageKeyConfig, JSON.stringify(newConfig));
        // LƯU LÊN SHEET NGẦM
        fetch(this.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "saveConfig", data: newConfig }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        }).catch(err => console.error("Lỗi lưu Config", err));
    },

    // --- 3. QUẢN LÝ XÓA DỮ LIỆU (RESET) ---
    clearTrades: function() {
        localStorage.removeItem(this.storageKeyData);
        fetch(this.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "clearTrades" }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
    },

    factoryReset: function() {
        localStorage.removeItem(this.storageKeyData);
        localStorage.removeItem(this.storageKeyConfig);
        fetch(this.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "clearTrades" }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
    }

};

