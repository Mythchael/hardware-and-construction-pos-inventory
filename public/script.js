// --- GLOBAL VARIABLES ---
let inventory = [], salesHistory = [], activityLogs = [], usersList = [];
let employees = [], departments = [], positions = [];
let cart = [], editingItemId = null, editingEmpId = null;
let currentUserPermissions = [];
let editingUserId = null;
let pendingVoidId = null; // NEW: Track which ID is being voided

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

// --- AUTHENTICATION ---
async function checkAuth() {
    try {
        const res = await fetch('/api/check-auth');
        if (res.ok) {
            const data = await res.json();
            document.getElementById('current-user-display').innerText = data.username;
            currentUserPermissions = data.permissions || [];
            showApp();
        } else {
            showLogin();
        }
    } catch (e) {
        showLogin();
    }
}

function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-wrapper').classList.remove('hidden');
    
    applyUserPermissions();
    fetchInitialData();

    if (currentUserPermissions.includes('dashboard')) {
        switchTab('dashboard');
    } else if (currentUserPermissions.length > 0) {
        switchTab(currentUserPermissions[0]);
    } else {
        alert("You have no access permissions. Contact Admin.");
        handleLogout();
    }
}

function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-wrapper').classList.add('hidden');
}

function applyUserPermissions() {
    ['dashboard', 'inventory', 'pos', 'reports', 'activity', 'employees'].forEach(mod => {
        const btn = document.getElementById(`btn-${mod}`);
        if (btn) {
            if (currentUserPermissions.includes(mod)) btn.classList.remove('hidden');
            else btn.classList.add('hidden');
        }
    });
}

function fetchInitialData() {
    const needsInventory = currentUserPermissions.some(p => ['inventory', 'pos', 'dashboard'].includes(p));
    if (needsInventory) fetchInventory();

    const needsSales = currentUserPermissions.some(p => ['reports', 'dashboard'].includes(p));
    if (needsSales) fetchSales();

    if (currentUserPermissions.includes('employees')) {
        fetchEmployees().then(() => fetchUsers());
        fetchDepts();
        fetchPositions();
    }

    if (currentUserPermissions.includes('activity')) fetchLogs();
}

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (res.ok) {
            const data = await res.json();
            document.getElementById('current-user-display').innerText = data.username;
            currentUserPermissions = data.permissions || [];
            showApp();
        } else {
            errorMsg.classList.remove('hidden');
        }
    } catch (e) {
        errorMsg.innerText = "Connection Error";
        errorMsg.classList.remove('hidden');
    }
});

async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
}

// --- NAVIGATION ---
function switchTab(tabId) {
    if (!currentUserPermissions.includes(tabId)) return;

    ['dashboard', 'inventory', 'pos', 'reports', 'activity', 'employees'].forEach(id => {
        const view = document.getElementById(`view-${id}`);
        const btn = document.getElementById(`btn-${id}`);
        if(view) view.classList.add('hidden');
        if(btn) btn.classList.remove('bg-slate-800', 'text-orange-400');
    });
    
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    document.getElementById(`btn-${tabId}`).classList.add('bg-slate-800', 'text-orange-400');
    
    const titleEl = document.getElementById('page-title');
    if (titleEl) {
        const titles = { 
            'dashboard': 'Overview', 'inventory': 'Inventory', 'pos': 'Point of Sale', 
            'reports': 'Reports', 'activity': 'Activity Log', 'employees': 'Employee Management' 
        };
        titleEl.innerText = titles[tabId] || 'BuildMaster';
    }

    if(tabId === 'inventory') fetchInventory();
    if(tabId === 'reports') fetchSales();
    if(tabId === 'activity') fetchLogs();
    if(tabId === 'employees') { 
        fetchEmployees().then(() => fetchUsers());
        fetchDepts(); 
        fetchPositions(); 
    }
}

function switchEmpTab(subTab) {
    ['directory', 'org', 'users'].forEach(t => {
        document.getElementById(`emp-view-${t}`).classList.add('hidden');
        const btn = document.getElementById(`emp-tab-${t}`);
        btn.classList.remove('border-slate-800', 'text-slate-800', 'font-bold');
        btn.classList.add('border-transparent', 'text-gray-500');
    });
    document.getElementById(`emp-view-${subTab}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`emp-tab-${subTab}`);
    activeBtn.classList.remove('border-transparent', 'text-gray-500');
    activeBtn.classList.add('border-slate-800', 'text-slate-800', 'font-bold');
}

// --- REPORTS LOGIC ---
function renderSalesHistory() {
    const tbody = document.getElementById('sales-history-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    const emptyMsg = document.getElementById('sales-empty-msg');
    if (salesHistory.length === 0) {
        if(emptyMsg) emptyMsg.classList.remove('hidden');
    } else {
        if(emptyMsg) emptyMsg.classList.add('hidden');
        salesHistory.forEach(sale => {
            const row = `
                <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                    <td class="px-6 py-4 text-gray-500 text-xs">${sale.date}</td>
                    <td class="px-6 py-4 text-gray-800 font-medium truncate max-w-xs" title="${sale.itemsSummary}">${sale.itemsSummary || "Items"}</td>
                    <td class="px-6 py-4 text-right font-bold text-green-600">${formatMoney(sale.total)}</td>
                    <td class="px-6 py-4 text-center">
                        <button onclick="viewSaleDetails(${sale.id})" class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-2 rounded-full transition mr-2"><i class="fa-solid fa-eye"></i></button>
                        <button onclick="voidSale(${sale.id})" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-full transition"><i class="fa-solid fa-ban"></i></button>
                    </td>
                </tr>`;
            tbody.innerHTML += row;
        });
    }
}

function viewSaleDetails(id) {
    const sale = salesHistory.find(s => s.id === id);
    if(sale) showReceipt(sale, false);
}

function voidSale(id) {
    const sale = salesHistory.find(s => s.id === id);
    if (sale) showReceipt(sale, true); // Opens receipt preview with "Confirm Void" button
}

// 1. Triggered by the "Confirm Void" button in the Receipt Modal
function confirmVoid(id) {
    pendingVoidId = id; // Store ID
    
    // Reset Modal State
    document.getElementById('void-sup-user').value = '';
    document.getElementById('void-sup-pass').value = '';
    document.getElementById('void-error').classList.add('hidden');
    document.getElementById('void-target-id').innerText = '#' + id;

    // Show Modal with Animation
    const modal = document.getElementById('void-modal');
    modal.classList.remove('hidden');
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        modal.querySelector('div').classList.remove('scale-95');
    }, 10);
}

function closeVoidModal() {
    const modal = document.getElementById('void-modal');
    modal.classList.add('opacity-0'); 
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { 
        modal.classList.add('hidden'); 
        pendingVoidId = null;
    }, 300);
}

// 2. Triggered by "Authorize Void" button in the new Modal
async function processVoidAuth() {
    if (!pendingVoidId) return;

    const supUser = document.getElementById('void-sup-user').value;
    const supPass = document.getElementById('void-sup-pass').value;
    const errorMsg = document.getElementById('void-error');

    if (!supUser || !supPass) {
        errorMsg.innerText = "Please enter credentials";
        errorMsg.classList.remove('hidden');
        return;
    }

    try {
        // Step A: Verify Supervisor
        const verifyRes = await fetch('/api/verify-supervisor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: supUser, password: supPass })
        });

        if (!verifyRes.ok) {
            const err = await verifyRes.json();
            errorMsg.innerText = err.error || "Authentication Failed";
            errorMsg.classList.remove('hidden');
            return; 
        }

        // Step B: Perform Void Action (Pass approvedBy)
        const res = await fetch(`/api/sales/${pendingVoidId}/void`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvedBy: supUser }) // <--- NEW: Send Supervisor Name
        });
        
        if (res.ok) {
            showToast("Transaction Voided Successfully");
            closeVoidModal(); 
            closeReceipt();   
            fetchSales();     
            fetchInventory(); 
        } else {
            const data = await res.json();
            showToast(data.error || "Error processing void", true);
        }
    } catch (e) {
        console.error(e);
        errorMsg.innerText = "Connection Error";
        errorMsg.classList.remove('hidden');
    }
}

// ==========================================
// --- API CONNECTORS (CORE) ---
// ==========================================

async function fetchInventory() {
    try {
        const res = await fetch('/api/inventory');
        if(!res.ok) return handleAuthError(res);
        inventory = await res.json();
        if(currentUserPermissions.includes('dashboard')) updateDashboard();
        renderInventory();
        renderPosItems();
    } catch (e) { console.error("Inventory Error:", e); }
}

async function fetchSales() {
    try {
        const res = await fetch('/api/sales');
        if(!res.ok) return handleAuthError(res);
        salesHistory = await res.json();
        if(currentUserPermissions.includes('dashboard')) updateDashboard();
        renderSalesHistory();
    } catch (e) { console.error("Sales Error:", e); }
}

async function fetchLogs() { 
    try {
        const res = await fetch('/api/logs');
        if(!res.ok) return handleAuthError(res);
        activityLogs = await res.json();
        renderLogs();
    } catch (e) { console.error("Logs Error:", e); }
}

function handleAuthError(res) {
    if (res.status === 401 || res.status === 403) handleLogout();
}

// ==========================================
// --- DASHBOARD LOGIC ---
// ==========================================
function updateDashboard() {
    const totalItems = inventory.reduce((acc, item) => acc + (parseInt(item.stock) || 0), 0);
    const totalValue = inventory.reduce((acc, item) => acc + ((parseFloat(item.price) || 0) * (parseInt(item.stock) || 0)), 0);
    const totalRevenue = salesHistory.reduce((acc, sale) => acc + (parseFloat(sale.total) || 0), 0);
    const lowStockItems = inventory.filter(item => (parseInt(item.stock) || 0) < 10);

    const elItems = document.getElementById('dash-total-items');
    if(elItems) elItems.innerText = formatNumber(totalItems);
    
    document.getElementById('dash-total-value').innerText = formatMoney(totalValue);
    document.getElementById('dash-total-sales').innerText = formatMoney(totalRevenue);
    document.getElementById('dash-low-stock').innerText = formatNumber(lowStockItems.length);

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
}

// ==========================================
// --- INVENTORY MANAGEMENT ---
// ==========================================
function editItem(id) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    document.getElementById('inv-name').value = item.name;
    document.getElementById('inv-cat').value = item.category;
    document.getElementById('inv-price').value = item.price;
    document.getElementById('inv-stock').value = item.stock;
    document.getElementById('inv-unit').value = item.unit;
    editingItemId = id;
    const btn = document.querySelector('#inventory-form button[type="submit"]');
    if(btn) {
        btn.innerHTML = '<i class="fa-solid fa-save mr-2"></i> Update Item';
        btn.className = "w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition";
    }
    document.getElementById('inventory-form').scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('inventory-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const itemData = {
        name: document.getElementById('inv-name').value,
        category: document.getElementById('inv-cat').value,
        price: parseFloat(document.getElementById('inv-price').value),
        stock: parseInt(document.getElementById('inv-stock').value),
        unit: document.getElementById('inv-unit').value
    };

    if (editingItemId) {
        await fetch(`/api/inventory/${editingItemId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(itemData)
        });
        showToast("Item updated successfully");
        const btn = document.querySelector('#inventory-form button[type="submit"]');
        if(btn) {
            btn.innerHTML = '<i class="fa-solid fa-plus mr-2"></i> Add Item';
            btn.className = "w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded transition";
        }
        editingItemId = null;
    } else {
        await fetch('/api/inventory', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(itemData)
        });
        showToast("Item added successfully");
    }
    this.reset();
    fetchInventory();
});

function renderInventory() {
    const tbody = document.getElementById('inventory-table-body');
    if(!tbody) return;
    const searchInput = document.getElementById('inv-search');
    const search = searchInput ? searchInput.value.toLowerCase() : "";
    tbody.innerHTML = '';
    const filtered = inventory.filter(item => {
        const name = (item.name || "").toLowerCase();
        const category = (item.category || "").toLowerCase();
        return name.includes(search) || category.includes(search);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-gray-500">No items found.</td></tr>`;
    } else {
        filtered.forEach(item => {
            const row = `
                <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                    <td class="px-6 py-4 text-gray-500">#${item.id}</td>
                    <td class="px-6 py-4 font-medium text-gray-900">${item.name || "Unknown"}</td>
                    <td class="px-6 py-4"><span class="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">${item.category || "-"}</span></td>
                    <td class="px-6 py-4 text-right font-mono">${formatMoney(item.price || 0)}</td>
                    <td class="px-6 py-4 text-center"><span class="${(item.stock || 0) < 10 ? 'text-red-600 font-bold' : 'text-gray-700'}">${item.stock || 0}</span></td>
                    <td class="px-6 py-4 text-center text-gray-600 text-xs">${item.unit || '-'}</td>
                    <td class="px-6 py-4 text-center text-gray-500 text-xs">${formatMoney((item.stock || 0) * (item.price || 0))}</td>
                    <td class="px-6 py-4 text-center">
                        <button onclick="editItem(${item.id})" class="text-blue-500 hover:text-blue-700 transition mr-3"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteItem(${item.id})" class="text-red-500 hover:text-red-700 transition"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>`;
            tbody.innerHTML += row;
        });
    }
}

async function deleteItem(id) {
    if(confirm("Delete this item?")) {
        await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
        showToast("Deleted");
        fetchInventory();
    }
}

// --- POS LOGIC ---
function renderPosItems() {
    const grid = document.getElementById('pos-grid');
    if(!grid) return;
    const searchInput = document.getElementById('pos-search');
    const search = searchInput ? searchInput.value.toLowerCase() : "";
    grid.innerHTML = '';
    const filtered = inventory.filter(item => 
        ((item.name || "").toLowerCase().includes(search) || (item.category || "").toLowerCase().includes(search)) && (item.stock > 0)
    );
    filtered.forEach(item => {
        const card = `
            <div onclick="addToCart(${item.id})" class="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md hover:border-blue-400 transition group relative overflow-hidden">
                <div class="absolute top-0 right-0 bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-bl-lg">Stock: ${item.stock} ${item.unit || ''}</div>
                <h4 class="font-bold text-gray-800 text-sm mb-1 line-clamp-2 h-10">${item.name}</h4>
                <div class="flex justify-between items-end mt-2">
                    <span class="text-xs text-gray-500">${item.category}</span>
                    <span class="font-bold text-blue-600">${formatMoney(item.price)}</span>
                </div>
            </div>`;
        grid.innerHTML += card;
    });
}

function addToCart(id) {
    const item = inventory.find(i => i.id === id);
    const existing = cart.find(c => c.id === id);
    if (existing) {
        if(existing.qty < item.stock) existing.qty++;
        else showToast("Low Stock!", true);
    } else {
        cart.push({ ...item, qty: 1 });
    }
    renderCart();
}

function renderCart() {
    const container = document.getElementById('pos-cart-items');
    if(!container) return;
    let total = 0;
    container.innerHTML = cart.length ? '' : '<div class="text-center text-gray-400 mt-10 italic">Empty</div>';
    cart.forEach(item => {
        total += item.price * item.qty;
        container.innerHTML += `
            <div class="flex justify-between items-center bg-white p-3 rounded shadow-sm mb-2 border">
                <div>
                    <div class="font-bold">${item.name}</div>
                    <div class="text-xs text-gray-500">x${item.qty} @ ${formatMoney(item.price)}</div>
                </div>
                <div class="flex gap-2">
                    <button onclick="updateCartQty(${item.id}, -1)" class="bg-gray-200 px-2 rounded">-</button>
                    <button onclick="updateCartQty(${item.id}, 1)" class="bg-gray-200 px-2 rounded">+</button>
                </div>
            </div>`;
    });
    const grandTotalEl = document.getElementById('cart-grand-total');
    if(grandTotalEl) grandTotalEl.innerText = formatMoney(total);
    const subTotalEl = document.getElementById('cart-total');
    if(subTotalEl) subTotalEl.innerText = formatMoney(total);
}

function updateCartQty(id, change) {
    const cartItem = cart.find(c => c.id === id);
    const stockItem = inventory.find(i => i.id === id);
    if(!stockItem) return;
    if(change === 1 && cartItem.qty < stockItem.stock) cartItem.qty++;
    else if(change === -1 && cartItem.qty > 1) cartItem.qty--;
    else if(change === -1 && cartItem.qty === 1) cart = cart.filter(c => c.id !== id);
    renderCart();
}

async function processSale() {
    if(!cart.length) return;
    const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const cartDetails = JSON.parse(JSON.stringify(cart));
    const res = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart, total })
    });
    const result = await res.json();
    if(result.success) {
        cart = [];
        renderCart();
        fetchInventory();
        showReceipt({ id: result.saleId, date: result.date, total, details: cartDetails }, false);
        showToast("Sale Complete");
    }
}

// --- REPORTS LOGIC ---
function renderSalesHistory() {
    const tbody = document.getElementById('sales-history-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    const emptyMsg = document.getElementById('sales-empty-msg');
    if (salesHistory.length === 0) {
        if(emptyMsg) emptyMsg.classList.remove('hidden');
    } else {
        if(emptyMsg) emptyMsg.classList.add('hidden');
        salesHistory.forEach(sale => {
            const row = `
                <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                    <td class="px-6 py-4 text-gray-500 text-xs">${sale.date}</td>
                    <td class="px-6 py-4 text-gray-800 font-medium truncate max-w-xs" title="${sale.itemsSummary}">${sale.itemsSummary || "Items"}</td>
                    <td class="px-6 py-4 text-right font-bold text-green-600">${formatMoney(sale.total)}</td>
                    <td class="px-6 py-4 text-center">
                        <button onclick="viewSaleDetails(${sale.id})" class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-2 rounded-full transition mr-2"><i class="fa-solid fa-eye"></i></button>
                        <button onclick="voidSale(${sale.id})" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-full transition"><i class="fa-solid fa-ban"></i></button>
                    </td>
                </tr>`;
            tbody.innerHTML += row;
        });
    }
}

function viewSaleDetails(id) {
    const sale = salesHistory.find(s => s.id === id);
    if(sale) showReceipt(sale, false);
}

function voidSale(id) {
    const sale = salesHistory.find(s => s.id === id);
    if (sale) showReceipt(sale, true);
}

// --- ACTIVITY LOG LOGIC ---
function renderLogs() {
    const tbody = document.getElementById('activity-log-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(activityLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-400">No activity recorded yet.</td></tr>`;
    } else {
        activityLogs.forEach((log, index) => {
            let badgeClass = 'bg-blue-100 text-blue-700'; 
            if (log.action.includes('Delete') || log.action.includes('Void')) badgeClass = 'bg-red-100 text-red-700';
            if (log.action.includes('Add')) badgeClass = 'bg-green-100 text-green-700';
            if (log.action.includes('Update')) badgeClass = 'bg-orange-100 text-orange-700';

            const hasDetails = log.metadata !== null;
            const viewButton = hasDetails ? 
                `<button onclick="viewLogDetails(${index})" class="text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition"><i class="fa-solid fa-list-ul"></i></button>` : 
                `<span class="text-gray-300">-</span>`;

            const row = `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="px-6 py-3 text-gray-500 text-xs font-mono">${log.timestamp}</td>
                    <td class="px-6 py-3 font-bold text-slate-700">${log.user}</td>
                    <td class="px-6 py-3"><span class="px-2 py-1 rounded text-xs font-semibold ${badgeClass}">${log.action}</span></td>
                    <td class="px-6 py-3 text-sm text-gray-600 truncate max-w-xs" title="${log.details}">${log.details}</td>
                    <td class="px-6 py-3 text-center">${viewButton}</td>
                </tr>`;
            tbody.innerHTML += row;
        });
    }
}

function viewLogDetails(index) {
    const log = activityLogs[index];
    if (!log || !log.metadata) return;
    try {
        const meta = JSON.parse(log.metadata);
        showActivityModal(log, meta);
    } catch (e) {
        console.error("Log Parse Error", e);
        showToast("Error reading details", true);
    }
}

// Map database columns to readable labels for the viewer
const keyMap = {
    'lname': 'Last Name', 'fname': 'First Name', 'mname': 'Middle Name',
    'addr_brgy': 'Barangay', 'addr_city': 'City', 'addr_prov': 'Province',
    'philhealth': 'PhilHealth', 'pagibig': 'PagIBIG', 'sss': 'SSS',
    'mobile': 'Mobile', 'email': 'Email', 'civil_status': 'Civil Status', 'dob': 'Date of Birth',
    'dept_id': 'Department', 'pos_id': 'Position', 'username': 'Username', 'permissions': 'Permissions', 'name': 'Name',
    'category': 'Category', 'price': 'Price', 'stock': 'Stock', 'unit': 'Unit'
};

function showActivityModal(log, meta) {
    const modal = document.getElementById('activity-modal');
    const title = document.getElementById('act-modal-title');
    const body = document.getElementById('act-modal-body');
    
    title.innerText = log.action.toUpperCase();
    
    let content = `
        <div class="flex justify-between text-sm text-gray-500 mb-4 border-b pb-2">
            <span>User: <strong class="text-gray-700">${log.user}</strong></span>
            <span>${log.timestamp}</span>
        </div>
    `;

    if (log.action.includes("Sale") || log.action.includes("Void")) {
        // --- SALE / VOID VIEW ---
        content += `<div class="space-y-2">`;
        if (meta.items && Array.isArray(meta.items)) {
            meta.items.forEach(item => {
                content += `
                    <div class="flex justify-between items-center bg-gray-50 p-2 rounded">
                        <div>
                            <div class="font-bold text-gray-700">${item.name}</div>
                            <div class="text-xs text-gray-500">Qty: ${item.qty} x ${formatMoney(item.price)}</div>
                        </div>
                        <div class="font-mono font-bold text-slate-700">${formatMoney(item.price * item.qty)}</div>
                    </div>`;
            });
            content += `</div>
                <div class="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
                    <span class="text-gray-600 font-bold">Total Amount</span>
                    <span class="text-xl font-bold text-slate-800">${formatMoney(meta.total)}</span>
                </div>`;
            
            // --- NEW: Display Supervisor Approval ---
            if (meta.approvedBy) {
                content += `
                <div class="mt-4 bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-3">
                    <div class="bg-red-100 text-red-600 rounded-full p-1.5 mt-0.5">
                        <i class="fa-solid fa-user-shield text-sm"></i>
                    </div>
                    <div>
                        <p class="text-xs text-red-500 font-bold uppercase tracking-wide">Authorized By</p>
                        <p class="text-gray-800 font-medium">${meta.approvedBy}</p>
                    </div>
                </div>`;
            }
        }
    } else {
        // --- GENERIC VIEW (Employees, Inventory, Users) ---
        content += `<div class="grid grid-cols-2 gap-4">`;
        for (const [key, value] of Object.entries(meta)) {
            if(key === "id" || key === "photo") continue; // Skip internal IDs and large photo paths
            
            // Format value for display
            let displayVal = value;
            if (key === 'permissions' && Array.isArray(value)) displayVal = value.join(', ');
            
            // LOOKUP NAMES for Dept/Pos
            if (key === 'dept_id') {
                const dept = departments.find(d => d.id == value);
                displayVal = dept ? dept.name : value;
            }
            if (key === 'pos_id') {
                const pos = positions.find(p => p.id == value);
                displayVal = pos ? pos.name : value;
            }
            
            const label = keyMap[key] || key; // Use readable label or fallback to key

            content += `
                <div class="bg-gray-50 p-3 rounded border border-gray-100">
                    <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">${label}</div>
                    <div class="font-bold text-gray-800 break-words text-sm">${displayVal}</div>
                </div>`;
        }
        content += `</div>`;
    }
    body.innerHTML = content;
    modal.classList.remove('hidden');
    void modal.offsetWidth; 
    modal.classList.remove('opacity-0');
    modal.querySelector('div').classList.remove('scale-95');
}

function closeActivityModal() {
    const modal = document.getElementById('activity-modal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

// ==========================================
// --- EMPLOYEE MANAGEMENT LOGIC ---
// ==========================================

// 1. DATA FETCHING
async function fetchEmployees() {
    try {
        const res = await fetch('/api/employees');
        if(!res.ok) return handleAuthError(res);
        employees = await res.json();
        
        // Update Employee Table
        renderEmployeeTable();
        
        // Update User Dropdown (Create User Form)
        const userDropdown = document.getElementById('user-employee-select');
        if (userDropdown) {
            const currentSelection = userDropdown.value; // Store current selection
            userDropdown.innerHTML = '<option value="">-- Assign to Employee --</option>';
            employees.forEach(e => {
                userDropdown.innerHTML += `<option value="${e.id}">${e.lname}, ${e.fname}</option>`;
            });
            if (currentSelection) userDropdown.value = currentSelection; // Restore selection
        }
        
    } catch(e) { console.error(e); }
}
async function fetchDepts() {
    const res = await fetch('/api/departments');
    if(!res.ok) return handleAuthError(res);
    departments = await res.json();
    renderOrgLists();
    populateDropdown('emp-dept', departments);
}
async function fetchPositions() {
    const res = await fetch('/api/positions');
    if(!res.ok) return handleAuthError(res);
    positions = await res.json();
    renderOrgLists();
    populateDropdown('emp-pos', positions);
}
function populateDropdown(id, data) {
    const sel = document.getElementById(id);
    if(!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">Select...</option>';
    data.forEach(d => sel.innerHTML += `<option value="${d.id}">${d.name}</option>`);
    if(currentVal) sel.value = currentVal;
}

// 2. RENDERING LISTS
function renderEmployeeTable() {
    const tbody = document.getElementById('employee-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    employees.forEach(emp => {
        const photoSrc = emp.photo ? emp.photo : 'https://via.placeholder.com/40?text=IMG';
        
        const row = `
        <tr class="hover:bg-gray-50 border-b border-gray-100 transition">
            <td class="px-6 py-3">
                <img src="${photoSrc}" class="w-10 h-10 rounded-full object-cover border border-gray-200 bg-gray-100">
            </td>
            <td class="px-6 py-3 font-medium text-gray-800">${emp.lname}, ${emp.fname}</td>
            <td class="px-6 py-3 text-gray-600 text-xs">${emp.dept_name || '-'}</td>
            <td class="px-6 py-3 text-gray-600 text-xs">${emp.pos_name || '-'}</td>
            <td class="px-6 py-3 text-xs text-gray-500">
                <div>${emp.mobile || ''}</div>
                <div>${emp.email || ''}</div>
            </td>
            <td class="px-6 py-3 text-center">
                <button onclick="viewEmployee(${emp.id})" class="text-blue-500 hover:text-blue-700 mr-2" title="View"><i class="fa-solid fa-eye"></i></button>
                <button onclick="editEmployee(${emp.id})" class="text-orange-500 hover:text-orange-700 mr-2" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteEmployee(${emp.id})" class="text-red-500 hover:text-red-700" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

function renderOrgLists() {
    const dList = document.getElementById('dept-list');
    if(dList) {
        dList.innerHTML = departments.map(d => 
            `<li class="flex justify-between items-center bg-gray-50 px-3 py-2 rounded">
                <span>${d.name}</span>
                <button onclick="deleteDept(${d.id})" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-times"></i></button>
            </li>`
        ).join('');
    }

    const pList = document.getElementById('pos-list');
    if(pList) {
        pList.innerHTML = positions.map(p => 
            `<li class="flex justify-between items-center bg-gray-50 px-3 py-2 rounded">
                <span>${p.name}</span>
                <button onclick="deletePos(${p.id})" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-times"></i></button>
            </li>`
        ).join('');
    }
}

// 3. ADD/EDIT EMPLOYEE LOGIC
function openEmployeeModal() {
    editingEmpId = null;
    document.getElementById('employee-form').reset();
    document.getElementById('emp-photo-preview').classList.add('hidden');
    document.getElementById('emp-photo-placeholder').classList.remove('hidden');
    
    const modal = document.getElementById('emp-modal');
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); modal.children[0].classList.remove('scale-95'); }, 10);
}

function closeEmployeeModal() {
    const modal = document.getElementById('emp-modal');
    modal.classList.add('opacity-0');
    modal.children[0].classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById('emp-photo-preview');
            img.src = e.target.result;
            img.classList.remove('hidden');
            document.getElementById('emp-photo-placeholder').classList.add('hidden');
        }
        reader.readAsDataURL(input.files[0]);
    }
}

const empFieldMap = {
    'lname': 'emp-lname', 'fname': 'emp-fname', 'mname': 'emp-mname',
    'addr_brgy': 'emp-addr-brgy', 'addr_city': 'emp-addr-city', 'addr_prov': 'emp-addr-prov',
    'philhealth': 'emp-philhealth', 'pagibig': 'emp-pagibig', 'sss': 'emp-sss',
    'mobile': 'emp-mobile', 'email': 'emp-email', 'civil_status': 'emp-civil', 'dob': 'emp-dob'
};

async function saveEmployee() {
    const formData = new FormData();
    for (const [dbField, htmlId] of Object.entries(empFieldMap)) {
        const el = document.getElementById(htmlId);
        if(el) formData.append(dbField, el.value);
    }
    const deptEl = document.getElementById('emp-dept');
    const posEl = document.getElementById('emp-pos');
    if(deptEl) formData.append('dept_id', deptEl.value);
    if(posEl) formData.append('pos_id', posEl.value);

    const photoInput = document.getElementById('emp-photo');
    if (photoInput && photoInput.files[0]) {
        formData.append('photo', photoInput.files[0]);
    }

    try {
        let res;
        if (editingEmpId) {
            res = await fetch(`/api/employees/${editingEmpId}`, { method: 'PUT', body: formData });
        } else {
            res = await fetch('/api/employees', { method: 'POST', body: formData });
        }

        if (res.ok) {
            showToast("Employee Record Saved");
            closeEmployeeModal();
            fetchEmployees();
        } else {
            const data = await res.json();
            showToast(data.error || "Error saving record", true);
        }
    } catch(e) { console.error(e); }
}

function editEmployee(id) {
    const emp = employees.find(e => e.id == id); // Use == for safe type comparison
    if (!emp) return; 
    
    openEmployeeModal();
    editingEmpId = id;
    for (const [dbField, htmlId] of Object.entries(empFieldMap)) {
        const el = document.getElementById(htmlId);
        if(el) el.value = emp[dbField] || '';
    }
    document.getElementById('emp-dept').value = emp.dept_id || "";
    document.getElementById('emp-pos').value = emp.pos_id || "";
    if(emp.photo) {
        const img = document.getElementById('emp-photo-preview');
        img.src = emp.photo;
        img.classList.remove('hidden');
        document.getElementById('emp-photo-placeholder').classList.add('hidden');
    }
}

async function deleteEmployee(id) {
    if(confirm("Delete employee record?")) {
        await fetch(`/api/employees/${id}`, { method: 'DELETE' });
        showToast("Employee Deleted");
        fetchEmployees();
    }
}

// 4. VIEW EMPLOYEE MODAL (Using Detailed Format from Activity Log)
function viewEmployee(id) {
    // Ensure ID comparison is safe
    const emp = employees.find(e => e.id == id);
    if (!emp) return console.error("Employee not found for view:", id);

    const modal = document.getElementById('view-emp-modal');
    const content = document.getElementById('view-emp-content');
    
    const photoSrc = emp.photo || 'https://via.placeholder.com/150';

    // Build the content for the modal using the keyMap and empFieldMap logic
    let detailsHtml = '';
    // We iterate over the keyMap to display the fields in a readable way, similar to showActivityModal
    const fieldsToDisplay = [
        'dept_id', 'pos_id', 'mobile', 'email', 'addr_brgy', 'addr_city', 'addr_prov', 
        'civil_status', 'dob', 'sss', 'philhealth', 'pagibig'
    ];

    fieldsToDisplay.forEach(key => {
        let value = emp[key];
        let label = keyMap[key] || key;

        // Lookup names for Dept/Pos
        if (key === 'dept_id') {
            const dept = departments.find(d => d.id == value);
            value = dept ? dept.name : (value || '-');
        }
        if (key === 'pos_id') {
            const pos = positions.find(p => p.id == value);
            value = pos ? pos.name : (value || '-');
        }
        
        detailsHtml += `
            <div class="bg-gray-50 p-3 rounded border border-gray-100">
                <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">${label}</div>
                <div class="font-bold text-gray-800 break-words text-sm">${value || '-'}</div>
            </div>`;
    });
    
    content.innerHTML = `
        <div class="w-full flex flex-col md:flex-row gap-6">
            <div class="w-full md:w-1/3 text-center border-r border-gray-100 pr-4 md:pr-6">
                <img src="${photoSrc}" class="w-32 h-32 rounded-full mx-auto object-cover border-4 border-gray-100 mb-4">
                <h3 class="font-bold text-xl text-slate-800">${emp.fname} ${emp.lname}</h3>
                <p class="text-blue-600 font-medium">${emp.pos_name || 'No Position'}</p>
                <p class="text-gray-500 text-sm">${emp.dept_name || 'No Dept'}</p>
            </div>
            <div class="w-full md:w-2/3">
                <div class="grid grid-cols-2 gap-4 text-sm">
                    ${detailsHtml}
                </div>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); modal.children[0].classList.remove('scale-95'); }, 10);
}
function closeViewEmpModal() {
    const modal = document.getElementById('view-emp-modal');
    modal.classList.add('opacity-0');
    modal.children[0].classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// 5. ORG (DEPT/POS) LOGIC
async function addDepartment() {
    const name = document.getElementById('new-dept-name').value;
    if(!name) return;
    await fetch('/api/departments', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name}) });
    document.getElementById('new-dept-name').value = '';
    fetchDepts();
}
async function deleteDept(id) { if(confirm("Remove department?")) { await fetch(`/api/departments/${id}`, {method:'DELETE'}); fetchDepts(); } }

async function addPosition() {
    const name = document.getElementById('new-pos-name').value;
    if(!name) return;
    await fetch('/api/positions', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name}) });
    document.getElementById('new-pos-name').value = '';
    fetchPositions();
}
async function deletePos(id) { if(confirm("Remove position?")) { await fetch(`/api/positions/${id}`, {method:'DELETE'}); fetchPositions(); } }

// 6. SYSTEM USERS
async function fetchUsers() {
    // We check if employees are loaded first
    if(employees.length === 0) {
        await fetchEmployees();
    }

    const res = await fetch('/api/users');
    if(!res.ok) return handleAuthError(res);
    usersList = await res.json();
    
    // RENDER USER LIST with Employee Name Join
    const tbody = document.getElementById('users-table-body');
    if(!tbody) return;
    
    tbody.innerHTML = usersList.map(u => {
        // Link user to employee for display
        const emp = employees.find(e => e.id == u.employee_id);
        const empName = emp ? `${emp.lname}, ${emp.fname}` : '<span class="text-gray-400 italic">Unassigned</span>';
        
        return `
        <tr class="border-b border-gray-100">
            <td class="px-6 py-3">${empName}</td>
            <td class="px-6 py-3 font-bold">${u.username}</td>
            <td class="px-6 py-3 text-xs"><span class="bg-gray-100 px-2 py-1 rounded">${u.permissions.length} modules</span></td>
            <td class="px-6 py-3 flex gap-2">
                <button onclick="viewUserDetails(${u.id})" class="text-blue-500 hover:text-blue-700" title="View Details"><i class="fa-solid fa-eye"></i></button>
                <button onclick="editUser(${u.id})" class="text-orange-500 hover:text-orange-700" title="Edit User"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteUser(${u.id})" class="text-red-500" title="Delete User"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

// User Creation/Edit Form with Employee Selection
//let editingUserId = null; // Track user being edited

document.getElementById('user-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const selectedPerms = Array.from(document.querySelectorAll('.perm-check:checked')).map(cb => cb.value);
    
    // Get selected employee ID
    const empId = document.getElementById('user-employee-select').value;
    
    const userData = { 
        username: document.getElementById('user-name').value, 
        permissions: selectedPerms,
        employee_id: empId ? parseInt(empId) : null // Ensure integer or null
    };

    // Password logic: Only send if provided (for edits) or required (for new users)
    const password = document.getElementById('user-pass').value;
    if (password) {
        userData.password = password;
    } else if (!editingUserId) {
        showToast("Password is required for new users", true);
        return;
    }
    
    let res;
    if (editingUserId) {
        // UPDATE Existing User
        res = await fetch(`/api/users/${editingUserId}`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(userData) 
        });
    } else {
        // CREATE New User
        res = await fetch('/api/users', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(userData) 
        });
    }

    if(res.ok) { 
        showToast(editingUserId ? "User Updated" : "User Created"); 
        
        // Explicitly re-fetch both to ensure the join works correctly on the new row
        await fetchEmployees();
        await fetchUsers(); 
        
        resetUserForm();
    } else {
        const err = await res.json();
        showToast(err.error || "Error saving user", true);
    }
});

function editUser(id) {
    const user = usersList.find(u => u.id === id);
    if (!user) return;

    editingUserId = id;

    // Populate Form
    document.getElementById('user-name').value = user.username;
    // Don't populate password for security, leave blank to keep existing
    document.getElementById('user-pass').value = ""; 
    document.getElementById('user-pass').placeholder = "(Leave blank to keep current)";
    document.getElementById('user-employee-select').value = user.employee_id || "";

    // Set Permissions Checkboxes
    document.querySelectorAll('.perm-check').forEach(cb => {
        cb.checked = user.permissions.includes(cb.value);
    });

    // Change Button Text
    const btn = document.querySelector('#user-form button[type="submit"]');
    btn.textContent = "Update User";
    btn.classList.replace('bg-slate-800', 'bg-orange-600');
    btn.classList.replace('hover:bg-slate-700', 'hover:bg-orange-700');

    // Add Cancel Button if not exists
    let cancelBtn = document.getElementById('user-cancel-btn');
    if (!cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'user-cancel-btn';
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'w-full mt-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded transition';
        cancelBtn.onclick = resetUserForm;
        btn.parentNode.appendChild(cancelBtn);
    }
}

function resetUserForm() {
    editingUserId = null;
    document.getElementById('user-form').reset();
    document.getElementById('user-pass').placeholder = "********";
    
    const btn = document.querySelector('#user-form button[type="submit"]');
    btn.textContent = "Create User";
    btn.classList.replace('bg-orange-600', 'bg-slate-800');
    btn.classList.replace('hover:bg-orange-700', 'hover:bg-slate-700');

    const cancelBtn = document.getElementById('user-cancel-btn');
    if (cancelBtn) cancelBtn.remove();
}

async function deleteUser(id) { if(confirm("Delete user?")) { await fetch(`/api/users/${id}`, {method:'DELETE'}); fetchUsers(); } }

// NEW: View System User Details Modal
function viewUserDetails(id) {
    const user = usersList.find(u => u.id === id);
    if(!user) return;
    
    const modal = document.getElementById('view-user-modal');
    const content = document.getElementById('view-user-content');
    const emp = employees.find(e => e.id == user.employee_id);
    
    const empDisplay = emp ? `
        <div class="flex items-center gap-3 mb-4 bg-blue-50 p-3 rounded border border-blue-100">
            <img src="${emp.photo || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full object-cover">
            <div>
                <div class="font-bold text-slate-800">${emp.lname}, ${emp.fname}</div>
                <div class="text-xs text-blue-600">${emp.pos_name || 'No Position'} - ${emp.dept_name || 'No Dept'}</div>
            </div>
        </div>
    ` : `<div class="p-3 bg-gray-100 rounded text-gray-500 text-center text-sm mb-4">No Employee Assigned</div>`;

    const permsDisplay = user.permissions.map(p => 
        `<span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded border border-gray-200">${p}</span>`
    ).join(' ');

    content.innerHTML = `
        ${empDisplay}
        <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
                <span class="block text-xs text-gray-500 uppercase">Username</span>
                <span class="font-mono font-bold text-lg">${user.username}</span>
            </div>
            <div>
                <span class="block text-xs text-gray-500 uppercase">System ID</span>
                <span class="font-mono">#${user.id}</span>
            </div>
        </div>
        <div class="mt-4">
            <span class="block text-xs text-gray-500 uppercase mb-2">Access Permissions</span>
            <div class="flex flex-wrap gap-2">
                ${permsDisplay}
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); modal.children[0].classList.remove('scale-95'); }, 10);
}

function closeViewUserModal() {
    const modal = document.getElementById('view-user-modal');
    modal.classList.add('opacity-0');
    modal.children[0].classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// --- HELPERS ---
function formatMoney(amount) { return '₱' + (parseFloat(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatNumber(num) { return (parseInt(num) || 0).toLocaleString('en-US'); }
function showToast(msg, err=false) {
    const toast = document.getElementById("toast");
    if(!toast) return;
    toast.innerText = msg;
    toast.className = "toast show";
    toast.style.backgroundColor = err ? "#ef4444" : "#333";
    setTimeout(() => toast.className = "toast", 3000);
}

// --- RECEIPT MODAL ---
function showReceipt(saleRecord, isVoidMode = false) {
    const modal = document.getElementById('receipt-modal');
    const content = document.getElementById('receipt-content');
    const header = content.firstElementChild; 
    const title = header.querySelector('h2');
    const footer = content.lastElementChild; 
    
    document.getElementById('rec-id').innerText = '#' + saleRecord.id;
    document.getElementById('rec-date').innerText = 'Date: ' + saleRecord.date;
    document.getElementById('rec-total').innerText = formatMoney(saleRecord.total);
    
    const itemsContainer = document.getElementById('rec-items');
    itemsContainer.innerHTML = '';
    (saleRecord.details || []).forEach(item => {
        itemsContainer.innerHTML += `
            <div class="flex justify-between text-sm py-1 border-b border-gray-100">
                <div class="flex flex-col w-2/3">
                    <span class="text-gray-800 font-medium truncate">${item.name}</span>
                    <span class="text-xs text-gray-500">x${item.qty} @ ${formatMoney(item.price)}</span>
                </div>
                <span class="text-gray-900 font-mono font-medium">${formatMoney(item.price * item.qty)}</span>
            </div>`;
    });

    const oldWarning = document.getElementById('void-warning');
    if(oldWarning) oldWarning.remove();

    header.className = 'p-4 text-center text-white'; 
    header.classList.remove('bg-slate-800', 'bg-red-700');

    if (isVoidMode) {
        header.classList.add('bg-red-700');
        title.innerText = "CONFIRM VOID";
        const warning = document.createElement('div');
        warning.id = 'void-warning';
        warning.className = "bg-red-50 border-l-4 border-red-500 p-4 mb-4 text-sm text-red-700";
        warning.innerHTML = "<p class='font-bold'>Warning: Irreversible Action</p><p>Items will return to inventory.</p>";
        itemsContainer.before(warning);
        footer.innerHTML = `
            <button onclick="closeReceipt()" class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold">Cancel</button>
            <button onclick="confirmVoid(${saleRecord.id})" class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold">Confirm Void</button>`;
    } else {
        header.classList.add('bg-slate-800');
        title.innerText = "BUILDMASTER";
        footer.innerHTML = `
            <button onclick="closeReceipt()" class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold">Close</button>
            <button onclick="window.print()" class="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-semibold flex items-center justify-center gap-2"><i class="fa-solid fa-print"></i> Print</button>`;
    }
    modal.classList.remove('hidden');
    void modal.offsetWidth; 
    modal.classList.remove('opacity-0');
    modal.querySelector('div').classList.remove('scale-95');
}

function closeReceipt() {
    const modal = document.getElementById('receipt-modal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}