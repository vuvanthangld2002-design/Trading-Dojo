const MT5Parser = {
    parse: function(htmlContent) {
        console.log("Đang xử lý file Exness Standard Cent...");
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        // Chọn tất cả các dòng trong bảng
        const rows = Array.from(doc.querySelectorAll('tr'));
        let trades = [];

        let inStatusSection = false;
        rows.forEach((row) => {
            const rowText = (row.innerText || '').toLowerCase();
            // Detect section headers to only parse the "Trang thai" (status) table
            if (rowText.includes('lệnh có trạng thái') || rowText.includes('trang thai') || rowText.includes('thời gian') && rowText.includes('lệnh có trạng thái')) {
                inStatusSection = true;
                return; // header row
            }
            if (rowText.includes('các lệnh đặt') || rowText.includes('deals') || rowText.includes('các lệnh đặt') ) {
                inStatusSection = false;
                return;
            }

            // Only parse rows inside the status table
            if (!inStatusSection) return;

            // proceed
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
        
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
            
        
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length === 0) return;

            // Lấy mảng text của từng cell để dễ dò vị trí cột
            const texts = cells.map(td => td.innerText?.trim() || '');

            // Tìm vị trí cột chứa 'Buy' hoặc 'Sell' (case-insensitive)
            const typeIndex = texts.findIndex(t => {
                if (!t) return false;
                const tt = t.toLowerCase();
                return tt === 'buy' || tt === 'sell';
            });

            if (typeIndex === -1) return; // không phải dòng lệnh thực

            const type = texts[typeIndex].toLowerCase();

            // Dựa trên cấu trúc phổ biến: time(0), ticket(1), symbol(2), type(3), hidden(4), volume(5), price(6), sl(7), tp(8), profit(last)
            // Nhưng vì có cột hidden với colspan, ta tính offset tương đối từ typeIndex
            const time = texts[typeIndex - 3] || '';
            const ticket = texts[typeIndex - 2] || '';
            const symbol = texts[typeIndex - 1] || '';

            const volume = texts[typeIndex + 2] || '';
            const price = texts[typeIndex + 3] || '';
            const sl = texts[typeIndex + 4] || '';
            const tp = texts[typeIndex + 5] || '';

            // Lấy ô profit từ ô cuối cùng khả dĩ có số
            let profitCellText = '';
            for (let i = texts.length - 1; i >= 0; i--) {
                if (texts[i] !== '') {
                    profitCellText = texts[i];
                    break;
                }
            }

            // Dọn chuỗi profit: loại bỏ khoảng trắng, dấu phẩy hàng nghìn, ký tự không số ngoài '.' và '-'
            let profitNum = NaN;
            if (profitCellText) {
                let cleaned = profitCellText.replace(/\s/g, '').replace(/,/g, '');
                cleaned = cleaned.replace(/[^0-9.\-]/g, '');
                profitNum = parseFloat(cleaned);
            }

            if (!isNaN(profitNum)) {
                trades.push({
                    ticket: ticket,
                    time: time,
                    type: type,
                    symbol: symbol,
                    size: volume,
                    price: price,
                    sl: sl,
                    tp: tp,
                    profit: profitNum
                });
            }
        });

        console.log(`Đã tìm thấy ${trades.length} lệnh hợp lệ.`);
        if (trades.length === 0) {
            // In debug: in ra vài hàng đầu để kiểm tra layout cột
            const sample = rows.slice(0, 10).map(r => Array.from(r.querySelectorAll('td')).map(td => td.innerText?.trim() || ''));
            console.log('Debug: first rows td texts:', sample);
        }
        return trades;
    }
};