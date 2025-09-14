export function renderLoginScreen(stores = [], users = [], isFirstRun = false, error = null) {
    const loginContainer = document.getElementById('login-screen');
    if (!loginContainer) return;
    loginContainer.classList.remove('hidden');
    
    loginContainer.innerHTML = `
        <div class="w-full max-w-sm mx-auto">
            <div class="absolute top-5 right-5">
                <button id="theme-toggle-login" type="button" class="text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-lg text-sm p-2.5">
                    <i data-lucide="sun" class="w-5 h-5 hidden theme-icon-sun"></i>
                    <i data-lucide="moon" class="w-5 h-5 theme-icon-moon"></i>
                </button>
            </div>
            <div id="main-login-box" class="custom-card p-8 rounded-2xl shadow-lg text-center">
                <div class="mx-auto mb-4 inline-block p-3 bg-brand-primary/20 rounded-full"><i data-lucide="shopping-basket" class="w-8 h-8 text-brand-primary"></i></div>
                <h1 class="text-2xl font-bold text-slate-900 dark:text-white mb-1">Sistema de Vendas</h1>
                ${error ? `<p class="text-red-500">${error}</p>` : ''}
                <div id="login-flow-container"></div>
            </div>
        </div>
    `;
    
    if (isFirstRun) {
        _renderFirstRunView();
    } else if (stores.length > 1) {
        _renderStoreSelection(stores);
    } else {
        _renderUserSelection(users, stores.length > 0 ? stores[0] : null);
    }

    window.lucide.createIcons();
    updateThemeIcons();
}

export function _renderStoreSelection(stores) { /* ...código da função... */ }
export function _renderUserSelection(users, store) { /* ...código da função... */ }
export function _renderPasswordView(selectedUser) { /* ...código da função... */ }
function _renderFirstRunView() { /* ...código da função... */ }
export function clearLoginScreen() {
    const loginContainer = document.getElementById('login-screen');
    if(loginContainer) loginContainer.innerHTML = '';
}
export function renderAppShell(user, store, allStores = null) { /* ...código da função... */ }
export function renderView(viewId) { /* ...código da função... */ }
export function clearApp() { /* ...código da função... */ }
export function showMobileMenu(show) { /* ...código da função... */ }
function updateThemeIcons() { /* ...código da função... */ }
export function applyTheme(theme) { /* ...código da função... */ }
export function setupThemeToggle(onThemeChangeCallback) { /* ...código da função... */ }
export function renderAppLoading() {
    const appContainer = document.getElementById('app');
    if(appContainer) {
        appContainer.classList.remove('hidden');
        appContainer.innerHTML = '<div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-primary mx-auto mt-20"></div>';
    }
}