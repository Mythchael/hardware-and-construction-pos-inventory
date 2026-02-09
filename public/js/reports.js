import { state } from './state.js';
import { toggleLoading, handleAuthError, showToast, formatMoney } from './utils.js';
import { updateDashboard } from './dashboard.js';
import { fetchInventory } from './inventory.js';
import { fetchSales as refreshSales } from './reports.js'; // Self reference for refreshing

export async function fetchSales() {
    toggleLoading(true);
    try {
        const res = await fetch('/api/sales');
        if(!res.ok) return handleAuthError(res);
        state.salesHistory = await res.json();
        if(state.currentUserPermissions.includes('dashboard')) updateDashboard();
        renderSalesHistory();
    } catch (e) { console.error(e); }
    finally { toggleLoading(false); }
}

export function renderSalesHistory() {
    const tbody = document.getElementById('sales-history-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    if (state.salesHistory.length === 0) {
        document.getElementById('sales-empty-msg')?.classList.remove('hidden');
    } else {
        document.getElementById('sales-empty-msg')?.classList.add('hidden');
        state.salesHistory.forEach(sale => {
            tbody.innerHTML += `
                <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                    <td class="px-6 py-4 text-gray-500 text-xs">${sale.date}</td>
                    <td class="px-6 py-4 text-gray-800 font-medium truncate max-w-xs" title="${sale.itemsSummary}">${sale.itemsSummary || "Items"}</td>
                    <td class="px-6 py-4 text-right font-bold text-green-600">${formatMoney(sale.total)}</td>
                    <td class="px-6 py-4 text-center">
                        <button onclick="viewSaleDetails(${sale.id})" class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-2 rounded-full transition mr-2"><i class="fa-solid fa-eye"></i></button>
                        <button onclick="voidSale(${sale.id})" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-full transition"><i class="fa-solid fa-ban"></i></button>
                    </td>
                </tr>`;
        });
    }
}

export function viewSaleDetails(id) {
    const sale = state.salesHistory.find(s => s.id === id);
    if(sale) showReceipt(sale, false);
}

export function voidSale(id) {
    const sale = state.salesHistory.find(s => s.id === id);
    if (sale) showReceipt(sale, true);
}

export function showReceipt(saleRecord, isVoidMode = false) {
    const modal = document.getElementById('receipt-modal');
    document.getElementById('rec-id').innerText = '#' + saleRecord.id;
    document.getElementById('rec-date').innerText = 'Date: ' + saleRecord.date;
    document.getElementById('rec-total').innerText = formatMoney(saleRecord.total);
    const itemsContainer = document.getElementById('rec-items');
    itemsContainer.innerHTML = '';
    (saleRecord.details || []).forEach(item => {
        itemsContainer.innerHTML += `
            <div class="flex justify-between text-xs py-1 border-b border-gray-100">
                <div class="flex flex-col w-2/3">
                    <span class="text-gray-800 font-medium truncate">${item.name}</span>
                    <span class="text-xs text-gray-500">x${item.qty} @ ${formatMoney(item.price)}</span>
                </div>
                <span class="text-gray-900 font-mono font-medium">${formatMoney(item.price * item.qty)}</span>
            </div>`;
    });
    const header = document.getElementById('receipt-content').firstElementChild;
    const title = header.querySelector('h2');
    const footer = document.getElementById('receipt-content').lastElementChild;
    document.getElementById('void-warning')?.remove();
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
        footer.innerHTML = `<button onclick="closeReceipt()" class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold">Cancel</button><button onclick="confirmVoid(${saleRecord.id})" class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold">Confirm Void</button>`;
    } else {
        header.classList.add('bg-slate-800');
        title.innerText = "BUILDMASTER";
        footer.innerHTML = `<button onclick="closeReceipt()" class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold no-print">Close</button><button onclick="printReceipt()" class="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-semibold flex items-center justify-center gap-2 no-print"><i class="fa-solid fa-print"></i> Print Receipt</button>`;
    }
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

export function closeReceipt() {
    const modal = document.getElementById('receipt-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

export function printReceipt() { setTimeout(() => window.print(), 250); }

// --- VOID MODAL LOGIC ---
export function confirmVoid(id) {
    state.pendingVoidId = id;
    document.getElementById('void-sup-user').value = '';
    document.getElementById('void-sup-pass').value = '';
    document.getElementById('void-error').classList.add('hidden');
    document.getElementById('void-target-id').innerText = '#' + id;
    const modal = document.getElementById('void-modal');
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); modal.querySelector('div').classList.remove('scale-95'); }, 10);
}

export function closeVoidModal() {
    const modal = document.getElementById('void-modal');
    modal.classList.add('opacity-0'); 
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); state.pendingVoidId = null; }, 300);
}

export async function processVoidAuth() {
    if (!state.pendingVoidId) return;
    const supUser = document.getElementById('void-sup-user').value;
    const supPass = document.getElementById('void-sup-pass').value;
    const errorMsg = document.getElementById('void-error');

    if (!supUser || !supPass) {
        errorMsg.innerText = "Please enter credentials";
        errorMsg.classList.remove('hidden');
        return;
    }

    try {
        const verifyRes = await fetch('/api/verify-supervisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: supUser, password: supPass }) });
        if (!verifyRes.ok) {
            const err = await verifyRes.json();
            errorMsg.innerText = err.error || "Authentication Failed";
            errorMsg.classList.remove('hidden');
            return; 
        }
        const res = await fetch(`/api/sales/${state.pendingVoidId}/void`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approvedBy: supUser }) });
        if (res.ok) {
            showToast("Transaction Voided Successfully");
            closeVoidModal(); 
            closeReceipt();   
            refreshSales();     
            fetchInventory(); 
        } else {
            const data = await res.json();
            showToast(data.error || "Error processing void", true);
        }
    } catch (e) {
        errorMsg.innerText = "Connection Error";
        errorMsg.classList.remove('hidden');
    }
}