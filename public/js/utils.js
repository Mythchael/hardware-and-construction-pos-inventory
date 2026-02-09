export function formatMoney(amount) { 
    return '₱' + (parseFloat(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }); 
}

export function formatNumber(num) { 
    return (parseInt(num) || 0).toLocaleString('en-US'); 
}

export function toggleLoading(show) {
    const loader = document.getElementById('loading-overlay');
    if(loader) show ? loader.classList.remove('hidden') : loader.classList.add('hidden');
}

export function showToast(msg, err=false) {
    const toast = document.getElementById("toast");
    if(!toast) return;
    toast.innerText = msg;
    toast.className = "toast show";
    toast.style.backgroundColor = err ? "#ef4444" : "#333";
    setTimeout(() => toast.className = "toast", 3000);
}

export function handleAuthError(res) { 
    if (res.status === 401 || res.status === 403) {
        location.reload(); 
    }
}