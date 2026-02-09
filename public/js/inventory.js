import { state } from './state.js';
import { toggleLoading, handleAuthError, showToast, formatMoney } from './utils.js';
import { updateDashboard } from './dashboard.js';
import { renderPosItems } from './pos.js';

export async function fetchInventory() {
    toggleLoading(true);
    try {
        const res = await fetch('/api/inventory');
        if(!res.ok) return handleAuthError(res);
        state.inventory = await res.json();
        if(state.currentUserPermissions.includes('dashboard')) updateDashboard();
        renderInventory();
        renderPosItems();
    } catch (e) { console.error(e); }
    finally { toggleLoading(false); }
}

export function renderInventory() {
    const tbody = document.getElementById('inventory-table-body');
    if(!tbody) return;
    const search = document.getElementById('inv-search')?.value.toLowerCase() || "";
    tbody.innerHTML = '';
    
    const filtered = state.inventory.filter(item => {
        const name = (item.name || "").toLowerCase();
        const cat = (item.category || "").toLowerCase();
        return name.includes(search) || cat.includes(search);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-gray-500">No items found.</td></tr>`;
    } else {
        filtered.forEach(item => {
            tbody.innerHTML += `
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
        });
    }
}

export function editItem(id) {
    const item = state.inventory.find(i => i.id === id);
    if (!item) return;
    document.getElementById('inv-name').value = item.name;
    document.getElementById('inv-cat').value = item.category;
    document.getElementById('inv-price').value = item.price;
    document.getElementById('inv-stock').value = item.stock;
    document.getElementById('inv-unit').value = item.unit;
    state.editingItemId = id;
    const btn = document.querySelector('#inventory-form button[type="submit"]');
    if(btn) {
        btn.innerHTML = '<i class="fa-solid fa-save mr-2"></i> Update Item';
        btn.className = "w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition";
    }
    document.getElementById('inventory-form').scrollIntoView({ behavior: 'smooth' });
}

export async function deleteItem(id) {
    if(confirm("Delete this item?")) {
        toggleLoading(true);
        try {
            await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
            showToast("Deleted");
            fetchInventory();
        } finally { toggleLoading(false); }
    }
}

export function initInventoryListeners() {
    document.getElementById('inventory-form')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        toggleLoading(true);
        const itemData = {
            name: document.getElementById('inv-name').value,
            category: document.getElementById('inv-cat').value,
            price: parseFloat(document.getElementById('inv-price').value),
            stock: parseInt(document.getElementById('inv-stock').value),
            unit: document.getElementById('inv-unit').value
        };
        try {
            if (state.editingItemId) {
                await fetch(`/api/inventory/${state.editingItemId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(itemData) });
                showToast("Item updated successfully");
                state.editingItemId = null;
                const btn = document.querySelector('#inventory-form button[type="submit"]');
                if(btn) { btn.innerHTML = 'Add Item'; btn.className = "w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded transition"; }
            } else {
                await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(itemData) });
                showToast("Item added successfully");
            }
            this.reset();
            fetchInventory();
        } finally { toggleLoading(false); }
    });
}