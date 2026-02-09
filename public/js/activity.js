import { state } from './state.js';
import { toggleLoading, handleAuthError, showToast, formatMoney } from './utils.js';

// --- API: Fetch Logs ---
export async function fetchLogs() { 
    toggleLoading(true);
    try {
        const res = await fetch('/api/logs');
        if(!res.ok) return handleAuthError(res);
        state.activityLogs = await res.json();
        renderLogs();
    } catch (e) { console.error("Logs Error:", e); }
    finally { toggleLoading(false); }
}

// --- Render Table ---
export function renderLogs() {
    const tbody = document.getElementById('activity-log-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(state.activityLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-400">No activity recorded yet.</td></tr>`;
    } else {
        state.activityLogs.forEach((log, index) => {
            let badgeClass = 'bg-blue-100 text-blue-700'; 
            if (log.action.includes('Delete') || log.action.includes('Void')) badgeClass = 'bg-red-100 text-red-700';
            if (log.action.includes('Add')) badgeClass = 'bg-green-100 text-green-700';
            if (log.action.includes('Update')) badgeClass = 'bg-orange-100 text-orange-700';

            const hasDetails = log.metadata !== null;
            const viewButton = hasDetails ? 
                `<button onclick="viewLogDetails(${index})" class="text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition"><i class="fa-solid fa-list-ul"></i></button>` : 
                `<span class="text-gray-300">-</span>`;

            tbody.innerHTML += `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="px-6 py-3 text-gray-500 text-xs font-mono">${log.timestamp}</td>
                    <td class="px-6 py-3 font-bold text-slate-700">${log.user}</td>
                    <td class="px-6 py-3"><span class="px-2 py-1 rounded text-xs font-semibold ${badgeClass}">${log.action}</span></td>
                    <td class="px-6 py-3 text-sm text-gray-600 truncate max-w-xs" title="${log.details}">${log.details}</td>
                    <td class="px-6 py-3 text-center">${viewButton}</td>
                </tr>`;
        });
    }
}

// --- Logic: Prepare Details for Modal ---
export function viewLogDetails(index) {
    const log = state.activityLogs[index];
    if (!log || !log.metadata) return;
    try {
        const meta = JSON.parse(log.metadata);
        showActivityModal(log, meta);
    } catch (e) {
        console.error("Log Parse Error", e);
        showToast("Error reading details", true);
    }
}

const keyMap = {
    'lname': 'Last Name', 'fname': 'First Name', 'mname': 'Middle Name',
    'addr_brgy': 'Barangay', 'addr_city': 'City', 'addr_prov': 'Province',
    'philhealth': 'PhilHealth', 'pagibig': 'PagIBIG', 'sss': 'SSS',
    'mobile': 'Mobile', 'email': 'Email', 'civil_status': 'Civil Status', 'dob': 'Date of Birth',
    'dept_id': 'Department', 'pos_id': 'Position', 'username': 'Username', 'permissions': 'Permissions', 'name': 'Name',
    'category': 'Category', 'price': 'Price', 'stock': 'Stock', 'unit': 'Unit'
};

export function showActivityModal(log, meta) {
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
        content += `<div class="grid grid-cols-2 gap-4">`;
        for (const [key, value] of Object.entries(meta)) {
            if(key === "id" || key === "photo") continue; 
            
            let displayVal = value;
            if (key === 'permissions' && Array.isArray(value)) displayVal = value.join(', ');
            
            if (key === 'dept_id') {
                const dept = state.departments.find(d => d.id == value);
                displayVal = dept ? dept.name : value;
            }
            if (key === 'pos_id') {
                const pos = state.positions.find(p => p.id == value);
                displayVal = pos ? pos.name : value;
            }
            
            const label = keyMap[key] || key; 

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
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        modal.querySelector('div').classList.remove('scale-95'); 
    }, 10);
}

export function closeActivityModal() {
    const modal = document.getElementById('activity-modal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}