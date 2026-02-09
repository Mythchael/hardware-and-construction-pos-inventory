import { state } from './state.js';
import { toggleLoading, handleAuthError, showToast } from './utils.js';

// --- DATA FETCHING ---
export async function fetchEmployees() {
    toggleLoading(true);
    try {
        const res = await fetch('/api/employees');
        if(!res.ok) return handleAuthError(res);
        state.employees = await res.json();
        
        renderEmployeeTable();
        
        // Update User Dropdown
        const userDropdown = document.getElementById('user-employee-select');
        if (userDropdown) {
            const currentSelection = userDropdown.value; 
            userDropdown.innerHTML = '<option value="">-- Assign to Employee --</option>';
            state.employees.forEach(e => {
                userDropdown.innerHTML += `<option value="${e.id}">${e.lname}, ${e.fname}</option>`;
            });
            if (currentSelection) userDropdown.value = currentSelection; 
        }
    } catch(e) { console.error(e); }
    finally { toggleLoading(false); }
}

export async function fetchDepts() {
    const res = await fetch('/api/departments');
    if(!res.ok) return handleAuthError(res);
    state.departments = await res.json();
    renderOrgLists();
    populateDropdown('emp-dept', state.departments);
}

export async function fetchPositions() {
    const res = await fetch('/api/positions');
    if(!res.ok) return handleAuthError(res);
    state.positions = await res.json();
    renderOrgLists();
    populateDropdown('emp-pos', state.positions);
}

function populateDropdown(id, data) {
    const sel = document.getElementById(id);
    if(!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">Select...</option>';
    data.forEach(d => sel.innerHTML += `<option value="${d.id}">${d.name}</option>`);
    if(currentVal) sel.value = currentVal;
}

// --- RENDER FUNCTIONS ---
export function renderEmployeeTable() {
    const tbody = document.getElementById('employee-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    state.employees.forEach(emp => {
        const photoSrc = emp.photo ? emp.photo : 'lib/placeholder.png';
        tbody.innerHTML += `
        <tr class="hover:bg-gray-50 border-b border-gray-100 transition">
            <td class="px-6 py-3 text-center">
                <img src="${photoSrc}" class="w-10 h-10 rounded-full mx-auto object-cover border border-gray-200 bg-gray-100">
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
    });
}

function renderOrgLists() {
    const dList = document.getElementById('dept-list');
    if(dList) {
        dList.innerHTML = state.departments.map(d => 
            `<li class="flex justify-between items-center bg-gray-50 px-3 py-2 rounded">
                <span>${d.name}</span>
                <button onclick="deleteDept(${d.id})" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-times"></i></button>
            </li>`
        ).join('');
    }

    const pList = document.getElementById('pos-list');
    if(pList) {
        pList.innerHTML = state.positions.map(p => 
            `<li class="flex justify-between items-center bg-gray-50 px-3 py-2 rounded">
                <span>${p.name}</span>
                <button onclick="deletePos(${p.id})" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-times"></i></button>
            </li>`
        ).join('');
    }
}

// --- ADD/EDIT EMPLOYEE LOGIC ---
const empFieldMap = {
    'lname': 'emp-lname', 'fname': 'emp-fname', 'mname': 'emp-mname',
    'addr_brgy': 'emp-addr-brgy', 'addr_city': 'emp-addr-city', 'addr_prov': 'emp-addr-prov',
    'philhealth': 'emp-philhealth', 'pagibig': 'emp-pagibig', 'sss': 'emp-sss',
    'mobile': 'emp-mobile', 'email': 'emp-email', 'civil_status': 'emp-civil', 'dob': 'emp-dob'
};

export function openEmployeeModal() {
    state.editingEmpId = null;
    document.getElementById('employee-form').reset();
    document.getElementById('emp-photo-preview').classList.add('hidden');
    document.getElementById('emp-photo-placeholder').classList.remove('hidden');
    
    const modal = document.getElementById('emp-modal');
    modal.classList.remove('hidden');
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        modal.querySelector('div').classList.remove('scale-95'); 
    }, 10);
}

export function closeEmployeeModal() {
    const modal = document.getElementById('emp-modal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

export function previewImage(input) {
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

export async function saveEmployee() {
    toggleLoading(true);
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
        if (state.editingEmpId) {
            res = await fetch(`/api/employees/${state.editingEmpId}`, { method: 'PUT', body: formData });
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
    finally { toggleLoading(false); }
}

export function editEmployee(id) {
    const emp = state.employees.find(e => e.id == id);
    if (!emp) return; 
    
    openEmployeeModal();
    state.editingEmpId = id;
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

export async function deleteEmployee(id) {
    if(confirm("Delete employee record?")) {
        await fetch(`/api/employees/${id}`, { method: 'DELETE' });
        showToast("Employee Deleted");
        fetchEmployees();
    }
}

// --- VIEW EMPLOYEE MODAL (UPDATED) ---
export function viewEmployee(id) {
    const emp = state.employees.find(e => e.id == id);
    if (!emp) return console.error("Employee not found:", id);

    const modal = document.getElementById('view-emp-modal');
    const content = document.getElementById('view-emp-content'); // Target inner container
    
    const photoSrc = emp.photo || 'lib/placeholder.png'; // Local placeholder

    // Map keys to readable labels
    const labelMap = {
        'dept_id': 'Department', 'pos_id': 'Position', 'mobile': 'Mobile', 'email': 'Email', 
        'addr_brgy': 'Barangay', 'addr_city': 'City', 'addr_prov': 'Province', 
        'civil_status': 'Civil Status', 'dob': 'Date of Birth', 
        'sss': 'SSS', 'philhealth': 'PhilHealth', 'pagibig': 'PagIBIG'
    };

    let detailsHtml = '';
    
    // We define the order we want fields to appear
    const fieldsToDisplay = [
        'dept_id', 'pos_id', 'mobile', 'email', 
        'addr_brgy', 'addr_city', 'addr_prov', 'civil_status', 
        'dob', 'sss', 'philhealth', 'pagibig'
    ];

    fieldsToDisplay.forEach(key => {
        let value = emp[key];
        let label = labelMap[key] || key;

        // Lookup IDs in state
        if (key === 'dept_id') {
            const d = state.departments.find(x => x.id == value);
            value = d ? d.name : (value || '-');
        }
        if (key === 'pos_id') {
            const p = state.positions.find(x => x.id == value);
            value = p ? p.name : (value || '-');
        }
        
        detailsHtml += `
            <div class="bg-gray-50 p-3 rounded border border-gray-100">
                <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">${label}</div>
                <div class="font-bold text-gray-800 break-words text-sm">${value || '-'}</div>
            </div>`;
    });
    
    // Inject into the content div, NOT overwriting the header
    content.innerHTML = `
        <div class="w-full flex flex-col md:flex-row gap-6">
            <div class="w-full md:w-1/3 text-center border-r border-gray-100 pr-4 md:pr-6 flex flex-col items-center">
                <img src="${photoSrc}" class="w-32 h-32 rounded-full object-cover border-4 border-gray-100 mb-4 bg-gray-200 shadow-sm">
                <h3 class="font-bold text-xl text-slate-800">${emp.fname} ${emp.lname}</h3>
                <p class="text-blue-600 font-medium text-sm mt-1">${emp.pos_name || 'No Position'}</p>
                <p class="text-gray-500 text-xs">${emp.dept_name || 'No Dept'}</p>
            </div>
            <div class="w-full md:w-2/3">
                <div class="grid grid-cols-2 gap-3 text-sm">
                    ${detailsHtml}
                </div>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        modal.querySelector('.transform').classList.remove('scale-95'); 
    }, 10);
}

export function closeViewEmpModal() {
    const modal = document.getElementById('view-emp-modal');
    modal.classList.add('opacity-0');
    modal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// --- ORG LOGIC ---
export async function addDepartment() {
    const name = document.getElementById('new-dept-name').value;
    if(!name) return;
    await fetch('/api/departments', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name}) });
    document.getElementById('new-dept-name').value = '';
    fetchDepts();
}
export async function deleteDept(id) { if(confirm("Remove department?")) { await fetch(`/api/departments/${id}`, {method:'DELETE'}); fetchDepts(); } }

export async function addPosition() {
    const name = document.getElementById('new-pos-name').value;
    if(!name) return;
    await fetch('/api/positions', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name}) });
    document.getElementById('new-pos-name').value = '';
    fetchPositions();
}
export async function deletePos(id) { if(confirm("Remove position?")) { await fetch(`/api/positions/${id}`, {method:'DELETE'}); fetchPositions(); } }

// --- SYSTEM USERS LOGIC ---
export async function fetchUsers() {
    toggleLoading(true);
    try {
        if(state.employees.length === 0) await fetchEmployees();

        const res = await fetch('/api/users');
        if(!res.ok) return handleAuthError(res);
        state.usersList = await res.json();
        
        const tbody = document.getElementById('users-table-body');
        if(!tbody) return;
        
        tbody.innerHTML = state.usersList.map(u => {
            const emp = state.employees.find(e => e.id == u.employee_id);
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
    } finally { toggleLoading(false); }
}

export function initEmployeeListeners() {
    document.getElementById('user-form')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        const selectedPerms = Array.from(document.querySelectorAll('.perm-check:checked')).map(cb => cb.value);
        
        const empId = document.getElementById('user-employee-select').value;
        const userData = { 
            username: document.getElementById('user-name').value, 
            permissions: selectedPerms,
            employee_id: empId ? parseInt(empId) : null 
        };

        const password = document.getElementById('user-pass').value;
        if (password) userData.password = password;
        else if (!state.editingUserId) {
            showToast("Password is required for new users", true);
            return;
        }
        
        let res;
        if (state.editingUserId) {
            res = await fetch(`/api/users/${state.editingUserId}`, { 
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userData) 
            });
        } else {
            res = await fetch('/api/users', { 
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userData) 
            });
        }

        if(res.ok) { 
            showToast(state.editingUserId ? "User Updated" : "User Created"); 
            await fetchEmployees(); 
            await fetchUsers(); 
            resetUserForm();
        } else {
            const err = await res.json();
            showToast(err.error || "Error saving user", true);
        }
    });
}

export function editUser(id) {
    const user = state.usersList.find(u => u.id === id);
    if (!user) return;

    state.editingUserId = id;

    // Populate Form
    document.getElementById('user-name').value = user.username;
    document.getElementById('user-pass').value = ""; 
    document.getElementById('user-pass').placeholder = "(Leave blank to keep current)";
    document.getElementById('user-employee-select').value = user.employee_id || "";

    document.querySelectorAll('.perm-check').forEach(cb => {
        cb.checked = user.permissions.includes(cb.value);
    });

    const btn = document.querySelector('#user-form button[type="submit"]');
    btn.textContent = "Update User";
    btn.classList.replace('bg-slate-800', 'bg-orange-600');
    btn.classList.replace('hover:bg-slate-700', 'hover:bg-orange-700');

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

export function resetUserForm() {
    state.editingUserId = null;
    document.getElementById('user-form').reset();
    document.getElementById('user-pass').placeholder = "********";
    
    const btn = document.querySelector('#user-form button[type="submit"]');
    btn.textContent = "Create User";
    btn.classList.replace('bg-orange-600', 'bg-slate-800');
    btn.classList.replace('hover:bg-orange-700', 'hover:bg-slate-700');

    const cancelBtn = document.getElementById('user-cancel-btn');
    if (cancelBtn) cancelBtn.remove();
}

export async function deleteUser(id) { if(confirm("Delete user?")) { await fetch(`/api/users/${id}`, {method:'DELETE'}); fetchUsers(); } }

export function viewUserDetails(id) {
    const user = state.usersList.find(u => u.id === id);
    if(!user) return;
    const modal = document.getElementById('view-user-modal');
    const content = document.getElementById('view-user-content');
    const emp = state.employees.find(e => e.id == user.employee_id);
    const empDisplay = emp ? `<div class="flex items-center gap-3 mb-4 bg-blue-50 p-3 rounded border border-blue-100"><img src="${emp.photo || 'lib/placeholder.png'}" class="w-10 h-10 rounded-full object-cover"><div><div class="font-bold text-slate-800">${emp.lname}, ${emp.fname}</div><div class="text-xs text-blue-600">${emp.pos_name || 'No Position'}</div></div></div>` : `<div class="p-3 bg-gray-100 rounded text-gray-500 text-center text-sm mb-4">No Employee Assigned</div>`;
    content.innerHTML = `${empDisplay}<div class="grid grid-cols-2 gap-4 text-sm"><div><span class="block text-xs text-gray-500 uppercase">Username</span><span class="font-mono font-bold text-lg">${user.username}</span></div><div><span class="block text-xs text-gray-500 uppercase">System ID</span><span class="font-mono">#${user.id}</span></div></div><div class="mt-4"><span class="block text-xs text-gray-500 uppercase mb-2">Access Permissions</span><div class="flex flex-wrap gap-2">${user.permissions.map(p=>`<span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded border border-gray-200">${p}</span>`).join(' ')}</div></div>`;
    modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); modal.children[0].classList.remove('scale-95'); }, 10);
}

export function closeViewUserModal() {
    const modal = document.getElementById('view-user-modal'); modal.classList.add('opacity-0'); modal.children[0].classList.add('scale-95'); setTimeout(() => modal.classList.add('hidden'), 300);
}