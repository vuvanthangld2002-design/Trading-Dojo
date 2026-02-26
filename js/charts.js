// js/charts.js
const ChartManager = {
    equityChart: null,
    systemChart: null,      // Biểu đồ Hệ thống (Mới)
    techMistakeChart: null, // Biểu đồ Lỗi Kỹ thuật (Mới)
    psyMistakeChart: null,  // Biểu đồ Lỗi Tâm lý (Mới)
    symbolChart: null,

    // 1. Chart Tài sản
    renderEquity: function(ctx, trades, initialCapital = 0) {
        let balance = initialCapital;
        const dataPoints = [initialCapital];
        const labels = ["Start"];

        trades.forEach((t, index) => {
            balance += t.profit;
            dataPoints.push(balance);
            labels.push(index + 1);
        });

        if (this.equityChart) this.equityChart.destroy();

        this.equityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tài Sản ($)',
                    data: dataPoints,
                    borderColor: '#3b82f6',
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
                        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
                        return gradient;
                    },
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }, 
                    x: { display: false } 
                }
            }
        });
    },

    // 2. [MỚI] Chart Hệ thống giao dịch (Hiển thị Winrate)
    renderSystemStats: function(ctx, trades) {
        // Tính toán thống kê
        const stats = {};
        trades.forEach(t => {
            const s = t.analysis.setup || "Chưa xác định";
            if (!stats[s]) stats[s] = { profit: 0, wins: 0, total: 0 };
            
            stats[s].profit += t.profit;
            stats[s].total += 1;
            if (t.profit > 0) stats[s].wins += 1;
        });

        // Chuyển dữ liệu sang mảng
        const labels = [];
        const profits = [];
        const winrates = [];
        const colors = [];

        for (const [name, data] of Object.entries(stats)) {
            const wr = data.total > 0 ? ((data.wins / data.total) * 100).toFixed(0) : 0;
            // Label hiển thị tên + Winrate
            labels.push(`${name} (WR: ${wr}%)`); 
            profits.push(data.profit);
            winrates.push(wr);
            colors.push(data.profit >= 0 ? '#10b981' : '#ef4444');
        }

        if (this.systemChart) this.systemChart.destroy();

        this.systemChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Lợi nhuận ($)',
                    data: profits,
                    backgroundColor: colors,
                    borderRadius: 4,
                    barPercentage: 0.6
                }]
            },
            options: {
                indexAxis: 'y', // Biểu đồ ngang
                responsive: true, maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` Profit: ${context.raw.toLocaleString()} $`;
                            }
                        }
                    }
                },
                scales: { 
                    x: { 
                        grid: { color: '#334155' }, 
                        ticks: { color: '#94a3b8' } 
                    },
                    y: { 
                        grid: { display: false }, 
                        ticks: { 
                            color: '#e2e8f0', 
                            font: { weight: 'bold', size: 11 },
                            autoSkip: false // Hiện tất cả tên setup
                        } 
                    }
                }
            }
        });
    },

    // 3. [MỚI] Chart Lỗi (Dùng chung function cho Tech và Psy)
    renderMistakes: function(ctx, trades, type) {
        const counts = {};
        trades.forEach(t => {
            // type là 'mistakeTech' hoặc 'mistakePsy'
            const m = t.analysis[type]; 
            // Chỉ đếm nếu có lỗi thực sự (Bỏ qua "Không có lỗi", "Tâm lý ổn định")
            if (m && !m.includes("Không có lỗi") && !m.includes("Tâm lý ổn định")) {
                counts[m] = (counts[m] || 0) + 1;
            }
        });

        // Nếu không có lỗi nào thì vẽ chart trống hoặc ẩn đi
        const labels = Object.keys(counts);
        const data = Object.values(counts);
        
        let chartInstance = type === 'mistakeTech' ? this.techMistakeChart : this.psyMistakeChart;
        if (chartInstance) chartInstance.destroy();

        // Config màu sắc đẹp
        const colors = ['#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308'];

        const newChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.length ? labels : ["Tốt (Không lỗi)"],
                datasets: [{
                    data: labels.length ? data : [1], // Nếu không lỗi thì vẽ 1 cục màu xanh
                    backgroundColor: labels.length ? colors : ['#10b981'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        position: 'right', 
                        labels: { color: '#cbd5e1', font: {size: 10}, boxWidth: 10 } 
                    }
                },
                cutout: '60%' // Làm lỗ ở giữa to ra cho đẹp
            }
        });

        // Gán lại vào biến quản lý
        if (type === 'mistakeTech') this.techMistakeChart = newChart;
        else this.psyMistakeChart = newChart;
    },

    // 4. Chart Symbol (Giữ nguyên)
    renderSymbolGrowth: function(ctx, trades) {
        const symbols = [...new Set(trades.map(t => t.symbol))];
        const datasets = symbols.map((sym, index) => {
            let runningBalance = 0;
            const data = [];
            trades.forEach(t => {
                if (t.symbol === sym) runningBalance += t.profit;
                data.push(runningBalance);
            });
            const neonColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
            return {
                label: sym, data: data,
                borderColor: neonColors[index % neonColors.length],
                backgroundColor: 'transparent',
                borderWidth: 2, tension: 0.2, pointRadius: 0,
                pointHoverRadius: 4
            };
        });

        if (this.symbolChart) this.symbolChart.destroy();
        this.symbolChart = new Chart(ctx, {
            type: 'line',
            data: { labels: trades.map((_, i) => i + 1), datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1', usePointStyle: true } } },
                scales: { y: { grid: { color: '#334155' } }, x: { display: false } }
            }
        });
    }
};