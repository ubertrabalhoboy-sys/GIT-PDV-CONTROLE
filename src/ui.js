function updateThemeIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    document.querySelectorAll('.theme-icon-moon').forEach(el => el.classList.toggle('hidden', isDark));
    document.querySelectorAll('.theme-icon-sun').forEach(el => el.classList.toggle('hidden', !isDark));
}

export function applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    updateThemeIcons();
}

export function setupThemeToggle() {
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('#theme-toggle-login')) {
            const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        }
    });
}

export function _renderFirstRunView() {
    const container = document.getElementById('login-flow-container');
    if (!container) return;
    container.innerHTML = `<p class="text-slate-500">Configurando sistema...</p>`;
}

export function _renderStoreSelection(stores) {
    const container = document.getElementById('login-flow-container');
    if (!container) return;
    container.innerHTML = `
        <p class="text-slate-600 dark:text-slate-400 mb-8">Selecione a sua loja</p>
        <div class="space-y-2">${stores.map(store => `
            <button class="w-full text-left p-4 custom-card rounded-lg" data-store-id="${store.id}">${store.name}</button>
        `).join('')}</div>`;
}

export function _renderUserSelection(users, store) {
    const container = document.getElementById('login-flow-container');
    if (!container) return;
    const userButtonsHTML = users.length > 0 ? users.map(user => `
        <button class="flex flex-col items-center p-4 custom-card rounded-lg" data-username="${user.name}" data-userid="${user.id}">
            <div class="w-16 h-16 mb-2 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-3xl font-bold">${user.name.charAt(0).toUpperCase()}</div>
            <span>${user.name}</span>
        </button>
    `).join('') : '<p>Nenhum usuário encontrado para esta loja.</p>';
    
    container.innerHTML = `
        <p class="mb-8">Quem está acessando? ${store ? `(${store.name})` : ''}</p>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">${userButtonsHTML}</div>
        ${store ? '' : '<button id="back-to-stores" class="mt-6 text-sm">Trocar de loja</button>'}
    `;
    window.lucide.createIcons();
}

export function _renderPasswordView(selectedUser) {
    const container = document.getElementById('login-flow-container');
    if (!container) return;
    container.innerHTML = `
        <div class="mb-4">
             <div class="w-20 h-20 mx-auto mb-3 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-4xl font-bold">${selectedUser.name.charAt(0).toUpperCase()}</div>
             <h3 class="text-xl font-bold">${selectedUser.name}</h3>
        </div>
        <form id="password-form">
            <input type="password" id="password" class="w-full px-4 py-2 text-center text-lg bg-slate-100/50 dark:bg-slate-900/50 border rounded-lg" placeholder="Digite sua senha" required>
            <p id="login-error" class="text-red-500 text-sm mt-2 h-5"></p>
            <div class="mt-4 flex gap-2 justify-center">
                <button type="button" id="back-to-users" class="px-5 py-2.5 rounded-lg bg-slate-200 dark:bg-slate-700">Voltar</button>
                <button type="submit" class="text-white bg-brand-primary font-medium rounded-lg px-5 py-2.5">Entrar</button>
            </div>
        </form>
    `;
    document.getElementById('password')?.focus();
}

export function renderLoginScreen(stores = [], users = [], isFirstRun = false, error = null) {
    const loginContainer = document.getElementById('login-screen');
    if (!loginContainer) return;
    loginContainer.classList.remove('hidden');
    
    loginContainer.innerHTML = `
        <div class="w-full max-w-sm mx-auto">
            <div class="absolute top-5 right-5">
                <button id="theme-toggle-login" type="button" class="p-2.5 rounded-lg">
                    <i data-lucide="sun" class="w-5 h-5 hidden theme-icon-sun"></i>
                    <i data-lucide="moon" class="w-5 h-5 theme-icon-moon"></i>
                </button>
            </div>
            <div id="main-login-box" class="custom-card p-8 rounded-2xl shadow-lg text-center">
                <div class="mx-auto mb-4 inline-block p-3 bg-brand-primary/20 rounded-full"><i data-lucide="shopping-basket" class="w-8 h-8 text-brand-primary"></i></div>
                <h1 class="text-2xl font-bold mb-1">Sistema de Vendas</h1>
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

export function clearLoginScreen() {
    const loginContainer = document.getElementById('login-screen');
    if(loginContainer) {
        loginContainer.innerHTML = '';
        loginContainer.classList.add('hidden');
    }
}

export function clearApp() {
    const appContainer = document.getElementById('app');
    if(appContainer) appContainer.innerHTML = '';
}

export function renderAppLoading() {
    const appContainer = document.getElementById('app');
    if(appContainer) {
        appContainer.classList.remove('hidden');
        appContainer.innerHTML = '<div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-primary mx-auto mt-20"></div>';
    }
}