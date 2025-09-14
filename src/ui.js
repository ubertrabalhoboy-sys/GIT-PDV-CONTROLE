// Adicione esta função ao final do seu arquivo src/ui.js

export function renderAppLoading() {
    const appContainer = document.getElementById('app');
    appContainer.classList.remove('hidden');
    appContainer.innerHTML = '<div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-primary mx-auto mt-20"></div>';
}
// Substitua todo o conteúdo de src/ui.js por este

import { formatCurrency } from './utils.js';
import { getStores } from './firebaseApi.js';

/**
 * Renderiza o fluxo completo de login.
 */
export function renderLoginScreen(stores = [], users = [], isFirstRun = false, error = null) {
    const loginContainer = document.getElementById('login-screen');
    loginContainer.classList.remove('hidden');
    
    let content = `
        <div class="w-full max-w-sm mx-auto">
            <div class="absolute top-5 right-5">
                <button id="theme-toggle-login" type="button" class="text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 focus:outline-none rounded-lg text-sm p-2.5">
                    <i data-lucide="sun" class="w-5 h-5 hidden theme-icon-sun"></i>
                    <i data-lucide="moon" class="w-5 h-5 theme-icon-moon"></i>
                </button>
            </div>
            <div id="main-login-box" class="custom-card p-8 rounded-2xl shadow-lg text-center">
                <div class="mx-auto mb-4 inline-block p-3 bg-brand-primary/20 rounded-full">
                    <i data-lucide="shopping-basket" class="w-8 h-8 text-brand-primary"></i>
                </div>
                <h1 id="login-store-name" class="text-2xl font-bold text-slate-900 dark:text-white mb-1">Sistema de Vendas</h1>
                ${error ? `<p class="text-red-500">${error}</p>` : ''}
                <div id="login-flow-container"></div>
            </div>
        </div>
    `;
    loginContainer.innerHTML = content;
    
    if (isFirstRun) {
        _renderFirstRunView();
    } else if (stores.length > 1) {
        _renderStoreSelection(stores);
    } else {
        _renderUserSelection(users);
    }

    window.lucide.createIcons();
    updateThemeIcons();
}

export function _renderStoreSelection(stores) {
    const container = document.getElementById('login-flow-container');
    container.innerHTML = `
        <p class="text-slate-600 dark:text-slate-400 mb-8">Selecione a sua loja</p>
        <div id="store-list" class="space-y-2">
            ${stores.map(store => `
                <button class="w-full text-left p-4 custom-card rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors duration-200" data-store-id="${store.id}">
                    ${store.name}
                </button>
            `).join('')}
        </div>
    `;
}

export function _renderUserSelection(users) {
    const container = document.getElementById('login-flow-container');
    const userButtonsHTML = users.length > 0 ? users.map(user => `
        <button class="flex flex-col items-center p-4 custom-card rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors duration-200 transform hover:scale-105" data-username="${user.name}" data-userid="${user.id}">
            <div class="w-16 h-16 mb-2 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 text-3xl font-bold">${user.name.charAt(0).toUpperCase()}</div>
            <span class="font-semibold text-slate-800 dark:text-slate-200 text-center">${user.name}</span>
        </button>
    `).join('') : '<p class="col-span-full text-center text-slate-500">Nenhum usuário encontrado.</p>';
    
    container.innerHTML = `
        <p class="text-slate-600 dark:text-slate-400 mb-8">Quem está acessando?</p>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">${userButtonsHTML}</div>
        <button id="back-to-stores" class="mt-6 text-sm text-slate-500 hover:text-brand-primary">Trocar de loja</button>
    `;
    window.lucide.createIcons();
}

export function _renderPasswordView(selectedUser) {
    const container = document.getElementById('login-flow-container');
    container.innerHTML = `
        <div class="mb-4">
             <div class="w-20 h-20 mx-auto mb-3 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 text-4xl font-bold">${selectedUser.name.charAt(0).toUpperCase()}</div>
             <h3 class="text-xl font-bold text-slate-900 dark:text-white">${selectedUser.name}</h3>
        </div>
        <form id="password-form">
            <input type="password" id="password" class="w-full px-4 py-2 text-center text-lg bg-slate-100/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-brand-primary focus:border-brand-primary" placeholder="Digite sua senha" required>
            <p id="login-error" class="text-red-500 text-sm mt-2 h-5"></p>
            <div class="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                <button type="button" id="back-to-users" class="w-full sm:w-auto px-5 py-2.5 text-sm font-medium focus:outline-none bg-slate-200/50 dark:bg-slate-700/50 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700">Voltar</button>
                <button type="submit" class="w-full sm:w-auto text-white bg-brand-primary hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center">Entrar</button>
            </div>
        </form>
    `;
    document.getElementById('password').focus();
}

function _renderFirstRunView() {
    const container = document.getElementById('login-flow-container');
    container.innerHTML = `
        <p class="text-slate-600 dark:text-slate-400 mb-6 text-center">Configurando o sistema...</p>
        <div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-primary mx-auto"></div>
    `;
}

export function clearLoginScreen() {
    const loginContainer = document.getElementById('login-screen');
    loginContainer.innerHTML = '';
    loginContainer.classList.add('hidden');
}

export function renderAppShell(user, store, allStores = null) {
    // ... (O resto do arquivo ui.js permanece o mesmo)
    // ... (A função renderAppShell, renderView, clearApp, etc. continuam aqui)
    const appContainer = document.getElementById('app');
    const sidebar = document.getElementById('sidebar');
    const header = document.getElementById('app-header');

    appContainer.classList.remove('hidden');

    const createMenuItem = (v, i, t) => `<li><a href="#" data-view="${v}" class="flex items-center p-2 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white group transition-colors"><i data-lucide="${i}" class="w-5 h-5"></i><span class="ml-3">${t}</span></a></li>`;
    const createLogoutItem = () => `<li class="pt-2 mt-2 border-t border-slate-700"><button data-action="logout" class="w-full flex items-center p-2 text-red-400 rounded-lg hover:bg-red-500 hover:text-white group transition-colors"><i data-lucide="log-out" class="w-5 h-5"></i><span class="ml-3">Sair</span></button></li>`;

    let menuHTML = '';
    if (user.role === 'vendedor') {
        menuHTML = createMenuItem('caixa', 'shopping-basket', 'Caixa') + createMenuItem('pedidos', 'list-ordered', 'Pedidos') + createLogoutItem();
    } else {
        menuHTML = createMenuItem('dashboard', 'layout-dashboard', 'Dashboard') + createMenuItem('produtos', 'package', 'Produtos') + createLogoutItem();
    }

    sidebar.innerHTML = `
        <div class="h-full px-3 py-4 overflow-y-auto">
            <div class="flex flex-col items-center mb-6 pb-4 border-b border-slate-700">
                <div class="w-16 h-16 mb-2 rounded-full bg-brand-primary flex items-center justify-center text-white text-3xl font-bold">${user.name.charAt(0).toUpperCase()}</div>
                <h5 class="text-xl font-semibold text-white">${user.name}</h5>
                <span class="text-sm text-slate-400">${store.name}</span>
            </div>
            <ul class="space-y-2 font-medium">${menuHTML}</ul>
        </div>
    `;

    header.innerHTML = `
        <div class="p-4 flex items-center justify-between">
            <div class="flex items-center gap-4">
                <button id="mobile-menu-button" class="sm:hidden text-slate-600 dark:text-slate-300"><i data-lucide="menu" class="w-6 h-6"></i></button>
                <h2 id="current-view-title" class="text-xl font-bold text-slate-900 dark:text-white"></h2>
            </div>
            <div class="flex items-center gap-4">
                ${user.role === 'superadmin' ? `<div id="store-switcher-container">...</div>` : ''}
                <button id="theme-toggle-app" type="button" class="text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 focus:outline-none rounded-lg text-sm p-2.5">
                    <i data-lucide="sun" class="w-5 h-5 hidden theme-icon-sun"></i>
                    <i data-lucide="moon" class="w-5 h-5 theme-icon-moon"></i>
                </button>
            </div>
        </div>
    `;

    window.lucide.createIcons();
    updateThemeIcons();
}

export function renderView(viewId, options = {}) {
    const mainContent = document.getElementById('main-content');
    const viewTitle = document.getElementById('current-view-title');
    const link = document.querySelector(`#sidebar a[data-view="${viewId}"]`);

    if (link) {
        viewTitle.textContent = link.querySelector('span').textContent;
        document.querySelectorAll('#sidebar ul li a').forEach(l => l.classList.remove('bg-slate-700', 'text-white'));
        link.classList.add('bg-slate-700', 'text-white');
    }

    mainContent.innerHTML = `<div id="${viewId}-view" class="view active fade-in"></div>`;
}

export function clearApp() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('sidebar').innerHTML = '';
    document.getElementById('app-header').innerHTML = '';
    document.getElementById('main-content').innerHTML = '';
}

export function showMobileMenu(show) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (show) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
}

function updateThemeIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    document.querySelectorAll('.theme-icon-moon').forEach(el => el.classList.toggle('hidden', isDark));
    document.querySelectorAll('.theme-icon-sun').forEach(el => el.classList.toggle('hidden', !isDark));
}

export function applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    updateThemeIcons();
}

export function setupThemeToggle(onThemeChangeCallback) {
    const handler = () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
        if (onThemeChangeCallback) {
            onThemeChangeCallback(newTheme);
        }
    };
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('#theme-toggle-login') || e.target.closest('#theme-toggle-app')) {
            handler();
        }
    });
    
}