import { state } from './state.js';
import { formatMoney, toggleLoading, showToast } from './utils.js';
import { fetchInventory } from './inventory.js';
import { showReceipt } from './reports.js';

export function renderPosItems() {
    const grid = document.getElementById('pos-grid');
    if(!grid) return;
    const search = document.getElementById('pos-search')?.value.toLowerCase() || "";
    grid.innerHTML = '';
    const filtered = state.inventory.filter(item => 
        ((item.name || "").toLowerCase().includes(search) || (item.category || "").toLowerCase().includes(search)) && (item.stock > 0)
    );
    filtered.forEach(item => {
        grid.innerHTML += `
            <div onclick="addToCart(${item.id})" class="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md hover:border-blue-400 transition group relative overflow-hidden">
                <div class="absolute top-0 right-0 bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-bl-lg">Stock: ${item.stock} ${item.unit || ''}</div>
                <h4 class="font-bold text-gray-800 text-sm mb-1 line-clamp-2 h-10">${item.name}</h4>
                <div class="flex justify-between items-end mt-2">
                    <span class="text-xs text-gray-500">${item.category}</span>
                    <span class="font-bold text-blue-600">${formatMoney(item.price)}</span>
                </div>
            </div>`;
    });
}

export function addToCart(id) {
    const item = state.inventory.find(i => i.id === id);
    const existing = state.cart.find(c => c.id === id);
    if (existing) {
        if(existing.qty < item.stock) existing.qty++;
        else showToast("Low Stock!", true);
    } else {
        state.cart.push({ ...item, qty: 1 });
    }
    renderCart();
}

export function renderCart() {
    const container = document.getElementById('pos-cart-items');
    if(!container) return;
    let total = 0;
    container.innerHTML = state.cart.length ? '' : '<div class="text-center text-gray-400 mt-10 italic">Empty</div>';
    state.cart.forEach(item => {
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
    document.getElementById('cart-grand-total').innerText = formatMoney(total);
    document.getElementById('cart-total').innerText = formatMoney(total);
}

export function updateCartQty(id, change) {
    const cartItem = state.cart.find(c => c.id === id);
    const stockItem = state.inventory.find(i => i.id === id);
    if(!stockItem) return;
    if(change === 1 && cartItem.qty < stockItem.stock) cartItem.qty++;
    else if(change === -1 && cartItem.qty > 1) cartItem.qty--;
    else if(change === -1 && cartItem.qty === 1) state.cart = state.cart.filter(c => c.id !== id);
    renderCart();
}

export async function processSale() {
    if(!state.cart.length) return;
    toggleLoading(true);
    try {
        const total = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const cartDetails = JSON.parse(JSON.stringify(state.cart));
        const res = await fetch('/api/checkout', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: state.cart, total })
        });
        const result = await res.json();
        if(result.success) {
            state.cart = [];
            renderCart();
            fetchInventory();
            showReceipt({ id: result.saleId, date: result.date, total, details: cartDetails }, false);
            showToast("Sale Complete");
        }
    } finally { toggleLoading(false); }
}