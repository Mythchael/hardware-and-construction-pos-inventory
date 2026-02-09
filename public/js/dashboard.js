import { state } from './state.js';
import { formatMoney, formatNumber } from './utils.js';

export function updateDashboard() {
    const totalItems = state.inventory.reduce((acc, item) => acc + (parseInt(item.stock) || 0), 0);
    const totalValue = state.inventory.reduce((acc, item) => acc + ((parseFloat(item.price) || 0) * (parseInt(item.stock) || 0)), 0);
    const totalRevenue = state.salesHistory.reduce((acc, sale) => acc + (parseFloat(sale.total) || 0), 0);
    const lowStockItems = state.inventory.filter(item => (parseInt(item.stock) || 0) < 10);

    const elItems = document.getElementById('dash-total-items');
    if(elItems) elItems.innerText = formatNumber(totalItems);
    
    document.getElementById('dash-total-value').innerText = formatMoney(totalValue);
    document.getElementById('dash-total-sales').innerText = formatMoney(totalRevenue);
    document.getElementById('dash-low-stock').innerText = formatNumber(lowStockItems.length);

    // Render Low Stock Table
    const lowStockTable = document.getElementById('dash-low-stock-table');
    if (lowStockTable) {
        lowStockTable.innerHTML = '';
        if(lowStockItems.length === 0) {
            document.getElementById('dash-no-alerts')?.classList.remove('hidden');
        } else {
            document.getElementById('dash-no-alerts')?.classList.add('hidden');
            lowStockItems.forEach(item => {
                lowStockTable.innerHTML += `
                    <tr>
                        <td class="px-6 py-3">${item.name || "Unknown"}</td>
                        <td class="px-6 py-3">${item.category || "-"}</td>
                        <td class="px-6 py-3 text-red-600 font-bold">${item.stock || 0}</td>
                        <td class="px-6 py-3 text-xs"><span class="bg-red-100 text-red-800 px-2 py-1 rounded">Low Stock</span></td>
                    </tr>`;
            });
        }
    }

    if (typeof Chart !== 'undefined') initCharts();
}

function initCharts() {
    if (typeof Chart === 'undefined') return;
    const today = new Date().toISOString().split('T')[0];
    const trendDateEl = document.getElementById('chart-trend-date');
    const catDateEl = document.getElementById('chart-cat-date');
    
    // Trend defaults to today
    if (trendDateEl && !trendDateEl.value) trendDateEl.value = today;
    
    // Category defaults to empty (All Time / Inventory Mode)
    // Removed the line that forced today's date on category chart to allow "Inventory Mode" by default
    
    renderTrendChart();
    renderCategoryChart();
}

export function renderTrendChart() {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;
    const mode = document.getElementById('chart-trend-mode').value;
    const dateInput = document.getElementById('chart-trend-date').value;
    const anchorDate = dateInput ? new Date(dateInput) : new Date();
    let labels = [], dataPoints = [], chartLabel = "";

    if (mode === 'weekly') {
        chartLabel = "Daily Revenue (Week)";
        for (let i = 6; i >= 0; i--) {
            const d = new Date(anchorDate); d.setDate(anchorDate.getDate() - i);
            const dateStr = d.toLocaleDateString();
            labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
            const dailyTotal = state.salesHistory.filter(s => new Date(s.date).toLocaleDateString() === dateStr)
                .reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
            dataPoints.push(dailyTotal);
        }
    } else if (mode === 'monthly') {
        chartLabel = `Daily Revenue (${anchorDate.toLocaleString('default', { month: 'long' })})`;
        const year = anchorDate.getFullYear();
        const month = anchorDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            labels.push(day);
            const dailyTotal = state.salesHistory.filter(s => {
                    const d = new Date(s.date);
                    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
                }).reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
            dataPoints.push(dailyTotal);
        }
    } else if (mode === 'yearly') {
        chartLabel = `Monthly Revenue (${anchorDate.getFullYear()})`;
        labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let m = 0; m < 12; m++) {
            const monthlyTotal = state.salesHistory.filter(s => {
                    const d = new Date(s.date);
                    return d.getFullYear() === anchorDate.getFullYear() && d.getMonth() === m;
                }).reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
            dataPoints.push(monthlyTotal);
        }
    }

    if (state.salesChartInstance) state.salesChartInstance.destroy();
    state.salesChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: { labels, datasets: [{ label: chartLabel, data: dataPoints, borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderWidth: 2, fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

export function renderCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    const dateInput = document.getElementById('chart-cat-date').value;
    const labelEl = document.getElementById('cat-chart-label'); // Ensure this element exists in HTML
    
    let chartLabels = [], chartData = [], title = "";

    if (dateInput) {
        // --- SALES MODE ---
        title = `Sales Volume (${dateInput})`;
        if(labelEl) labelEl.innerText = "Showing: Units Sold on selected date";
        
        const selectedDateStr = new Date(dateInput).toLocaleDateString();
        const targetSales = state.salesHistory.filter(s => new Date(s.date).toLocaleDateString() === selectedDateStr);
        
        let catMap = {};
        targetSales.forEach(sale => {
            (sale.details || []).forEach(item => {
                const invItem = state.inventory.find(i => i.id === item.id) || state.inventory.find(i => i.name === item.name);
                const cat = invItem ? invItem.category : "Discontinued";
                catMap[cat] = (catMap[cat] || 0) + item.qty;
            });
        });
        chartLabels = Object.keys(catMap); chartData = Object.values(catMap);
        
        if (chartLabels.length === 0) {
            chartLabels = ["No Sales"]; chartData = [1]; 
        }

    } else {
        // --- INVENTORY MODE ---
        title = "Inventory Distribution (Stock Level)";
        if(labelEl) labelEl.innerText = "Showing: Total Items currently in stock per category";
        
        // Count items per category
        const categories = [...new Set(state.inventory.map(item => item.category || "Other"))];
        chartLabels = categories;
        chartData = categories.map(cat => state.inventory.filter(i => i.category === cat).length);
        
        if (chartData.length === 0) {
            chartLabels = ["Empty Inventory"]; chartData = [1];
        }
    }

    if (state.categoryChartInstance) state.categoryChartInstance.destroy();
    
    state.categoryChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: { 
            labels: chartLabels, 
            datasets: [{ 
                data: chartData, 
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#94a3b8'], 
                borderWidth: 1 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                title: { display: true, text: title, font: { size: 14 } }, 
                legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } 
            } 
        }
    });
}

export function resetCategoryChart() {
    document.getElementById('chart-cat-date').value = "";
    renderCategoryChart();
}