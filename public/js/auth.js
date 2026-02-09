import { state } from './state.js';
import { toggleLoading } from './utils.js';

// NOTE: We do NOT import switchTab/applyUserPermissions from main.js to avoid circular dependency.
// We access them via 'window' because main.js is loaded and executed before checkAuth() runs.

export async function checkAuth() {
    toggleLoading(true);
    try {
        const res = await fetch('/api/check-auth');
        if (res.ok) {
            const data = await res.json();
            const displayText = data.displayName ? `${data.displayName} - ${data.username}` : data.username;
            document.getElementById('current-user-display').innerText = displayText;
            state.currentUserPermissions = data.permissions || [];
            showApp();
        } else {
            showLogin();
        }
    } catch (e) {
        showLogin();
    } finally {
        toggleLoading(false);
    }
}

export function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-wrapper').classList.remove('hidden');
    
    // Use window global functions defined in main.js
    if (window.applyUserPermissions) window.applyUserPermissions();
    if (window.fetchInitialData) window.fetchInitialData();

    if (state.currentUserPermissions.includes('dashboard')) {
        window.switchTab('dashboard');
    } else if (state.currentUserPermissions.length > 0) {
        window.switchTab(state.currentUserPermissions[0]);
    } else {
        alert("You have no access permissions. Contact Admin.");
        handleLogout();
    }
}

export function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-wrapper').classList.add('hidden');
}

export async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
}

export function initAuthListeners() {
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        toggleLoading(true);
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
                const displayText = data.displayName ? `${data.displayName} - ${data.username}` : data.username;
                document.getElementById('current-user-display').innerText = displayText;
                state.currentUserPermissions = data.permissions || [];
                showApp();
            } else {
                errorMsg.classList.remove('hidden');
            }
        } catch (e) {
            errorMsg.innerText = "Connection Error";
            errorMsg.classList.remove('hidden');
        } finally {
            toggleLoading(false);
        }
    });
}