import { state } from './state.js';
import { checkAuth, handleLogout, initAuthListeners } from './auth.js';
import { fetchInventory, renderInventory, editItem, deleteItem, initInventoryListeners } from './inventory.js';
import { fetchSales, renderSalesHistory, viewSaleDetails, voidSale, confirmVoid, closeReceipt, printReceipt, processVoidAuth, closeVoidModal } from './reports.js';
import { fetchLogs, renderLogs, viewLogDetails, closeActivityModal } from './activity.js';
import { fetchEmployees, fetchUsers, viewEmployee, editEmployee, deleteEmployee, saveEmployee, openEmployeeModal, closeEmployeeModal, editUser, deleteUser, viewUserDetails, closeViewUserModal, resetUserForm, initEmployeeListeners, addDepartment, deleteDept, addPosition, deletePos, fetchDepts, fetchPositions, previewImage, closeViewEmpModal } from './employees.js';
import { updateDashboard, renderTrendChart, renderCategoryChart, resetCategoryChart } from './dashboard.js';
import { renderPosItems, addToCart, updateCartQty, processSale } from './pos.js';

// --- 1. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // We start auth here. By this time, all window functions below are defined.
    checkAuth(); 
    initAuthListeners();
    initInventoryListeners();
    initEmployeeListeners();
});

// --- 2. GLOBAL EXPORTS ---
// These attaches functions to 'window' so HTML onclicks can find them
window.handleLogout = handleLogout;

// Inventory
window.editItem = editItem;
window.deleteItem = deleteItem;
window.renderInventory = renderInventory; // For search onkeyup

// POS
window.renderPosItems = renderPosItems;   // For pos search
window.addToCart = addToCart;
window.updateCartQty = updateCartQty;
window.processSale = processSale;

// Reports
window.viewSaleDetails = viewSaleDetails;
window.voidSale = voidSale;
window.confirmVoid = confirmVoid;
window.closeReceipt = closeReceipt;
window.printReceipt = printReceipt;
window.processVoidAuth = processVoidAuth;
window.closeVoidModal = closeVoidModal;

// Activity
window.viewLogDetails = viewLogDetails;
window.closeActivityModal = closeActivityModal;

// Dashboard
window.renderTrendChart = renderTrendChart;
window.renderCategoryChart = renderCategoryChart;
window.resetCategoryChart = resetCategoryChart;

// Employees / Users
window.viewEmployee = viewEmployee;
window.editEmployee = editEmployee;
window.deleteEmployee = deleteEmployee;
window.saveEmployee = saveEmployee;
window.openEmployeeModal = openEmployeeModal;
window.closeEmployeeModal = closeEmployeeModal;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.viewUserDetails = viewUserDetails;
window.closeViewUserModal = closeViewUserModal;
window.resetUserForm = resetUserForm;
window.addDepartment = addDepartment;
window.deleteDept = deleteDept;
window.addPosition = addPosition;
window.deletePos = deletePos;
window.previewImage = previewImage;
window.closeViewEmpModal = closeViewEmpModal;

// --- 3. NAVIGATION & CORE LOGIC (Attached to Window) ---

window.switchTab = function(tabId) {
    if (!state.currentUserPermissions.includes(tabId)) return;

    ['dashboard', 'inventory', 'pos', 'reports', 'activity', 'employees'].forEach(id => {
        const view = document.getElementById(`view-${id}`);
        const btn = document.getElementById(`btn-${id}`);
        if(view) view.classList.add('hidden');
        if(btn) btn.classList.remove('bg-slate-800', 'text-orange-400');
    });
    
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    document.getElementById(`btn-${tabId}`).classList.add('bg-slate-800', 'text-orange-400');
    
    // Refresh Data logic based on the tab opened
    if(tabId === 'inventory') fetchInventory();
    if(tabId === 'reports') fetchSales();
    if(tabId === 'activity') fetchLogs();
    if(tabId === 'employees') { 
        fetchEmployees().then(() => fetchUsers());
        fetchDepts(); 
        fetchPositions(); 
    }
}

window.switchEmpTab = function(subTab) {
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

// ATTACH THESE TO WINDOW SO AUTH.JS CAN USE THEM
window.fetchInitialData = function() {
    const p = state.currentUserPermissions;
    if (p.some(x => ['inventory', 'pos', 'dashboard'].includes(x))) fetchInventory();
    if (p.some(x => ['reports', 'dashboard'].includes(x))) fetchSales();
    if (p.includes('employees')) { fetchEmployees().then(() => fetchUsers()); fetchDepts(); fetchPositions(); }
    if (p.includes('activity')) fetchLogs();
}

window.applyUserPermissions = function() {
    ['dashboard', 'inventory', 'pos', 'reports', 'activity', 'employees'].forEach(mod => {
        const btn = document.getElementById(`btn-${mod}`);
        if (btn) state.currentUserPermissions.includes(mod) ? btn.classList.remove('hidden') : btn.classList.add('hidden');
    });
}