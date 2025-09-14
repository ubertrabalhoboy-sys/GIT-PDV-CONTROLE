/**
 * Módulo da Interface do Usuário (UI).
 * Contém todas as funções responsáveis por renderizar e manipular o DOM.
 * Este módulo não contém lógica de negócios.
 *
 * @file Módulo de renderização do DOM.
 * @summary Cria e atualiza dinamicamente os elementos HTML da aplicação.
 */
import { login, logout } from './auth.js';
import { formatCurrency, showToast } from './utils.js';
import { getSettings, getUsersForStore } from './firebaseApi.js';
import { setSelectedStore } from './auth.js';

let selectedUserForLogin = null;
let selectedStoreForLogin = null;

// --- Funções de Renderização da Tela de Login ---

/**
 * Renderiza o fluxo completo de login.
 * @param {Array} stores - Lista de lojas.
 * @param {Array} users - Lista de todos os usuários para seleção inicial.
 * @param {boolean} isFirstRun - Se for a primeira execução do sistema.
 * @param {string|null} error - Mensagem de erro a ser exibida.
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
    } else if (stores.length > 1 && !selectedStoreForLogin) { // Multi-loja
        _renderStoreSelection(stores);
    } else { // Loja única ou superadmin inicial
        _renderUserSelection(users.filter(u => u.role === 'superadmin' || stores.length === 0 || u.storeId === stores[0]?.id));
        if (stores.length === 1) {
            selectedStoreForLogin = stores[0];
        }
    }

    _attachLoginEventListeners();
    window.lucide.createIcons();
    updateThemeIcons();
}

function _renderStoreSelection(stores) {
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

function _renderUserSelection(users) {
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
        ${selectedStoreForLogin ? `<button id="back-to-stores" class="mt-6 text-sm text-slate-500 hover:text-brand-primary">Trocar de loja</button>` : ''}
    `;
    window.lucide.createIcons();
}

function _renderPasswordView() {
    const container = document.getElementById('login-flow-container');
    container.innerHTML = `
        <div class="mb-4">
             <div class="w-20 h-20 mx-auto mb-3 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 text-4xl font-bold">${selectedUserForLogin.name.charAt(0).toUpperCase()}</div>
             <h3 class="text-xl font-bold text-slate-900 dark:text-white">${selectedUserForLogin.name}</h3>
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
        <p class="text-slate-600 dark:text-slate-400 mb-6 text-center">Configurando o sistema pela primeira vez...</p>
        <div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-primary mx-auto"></div>
        <p class="text-xs text-slate-500 mt-4">Se esta tela persistir, verifique a configuração do Firebase e se o usuário 'superadmin' foi criado no console.</p>
    `;
}

function _attachLoginEventListeners() {
    const loginContainer = document.getElementById('login-screen');
    loginContainer.addEventListener('click', async (e) => {
        const storeButton = e.target.closest('button[data-store-id]');
        const userButton = e.target.closest('button[data-username]');
        const backToStores = e.target.closest('#back-to-stores');
        const backToUsers = e.target.closest('#back-to-users');

        if (storeButton) {
            const stores = await getStores();
            selectedStoreForLogin = stores.find(s => s.id === storeButton.dataset.storeId);
            const users = await getUsersForStore(selectedStoreForLogin.id);
            _renderUserSelection(users);
        }
        if (userButton) {
             const allUsers = await getUsersForStore(selectedStoreForLogin?.id); // Precisa buscar todos os usuários novamente
             const superAdmin = await getUsersForStore(null, true); // Busca superadmin
             const combinedUsers = [...allUsers, ...superAdmin];
             selectedUserForLogin = combinedUsers.find(u => u.id === userButton.dataset.userid);
             _renderPasswordView();
        }
        if (backToStores) {
            selectedStoreForLogin = null;
            renderLoginScreen(await getStores());
        }
        if (backToUsers) {
            _renderUserSelection(await getUsersForStore(selectedStoreForLogin.id));
        }
    });

    loginContainer.addEventListener('submit', async (e) => {
        if (e.target.id === 'password-form') {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const errorP = document.getElementById('login-error');
            const formBox = document.getElementById('main-login-box');
            
            errorP.textContent = '';
            
            try {
                const userProfile = await login(selectedUserForLogin.name, password);
                
                // Se for superadmin, a loja precisa ser definida.
                if (userProfile.role === 'superadmin' && !selectedStoreForLogin) {
                    const stores = await getStores();
                    selectedStoreForLogin = stores[0]; // Pega a primeira por padrão
                }
                
                if (!selectedStoreForLogin) throw new Error("Store not selected.");

                const settings = await getSettings(selectedStoreForLogin.id);
                selectedStoreForLogin.settings = settings;

                setSelectedStore(selectedStoreForLogin);
                sessionStorage.setItem('lastUserUID', userProfile.id);

                // A transição para a app será tratada pelo listener onAuthStateChanged
            } catch (error) {
                errorP.textContent = error.message;
                formBox.classList.add('animate-shake');
                setTimeout(() => formBox.classList.remove('animate-shake'), 500);
            }
        }
    });
}

export function clearLoginScreen() {
    const loginContainer = document.getElementById('login-screen');
    loginContainer.innerHTML = '';
    loginContainer.classList.add('hidden');
}

// --- Funções de Renderização da Aplicação Principal ---

/**
 * Renderiza o "esqueleto" da aplicação (sidebar, header).
 * @param {object} user - Objeto do usuário logado.
 * @param {object} store - Objeto da loja selecionada.
 * @param {Array|null} allStores - Lista de todas as lojas (para superadmin).
 */
export function renderAppShell(user, store, allStores = null) {
    const appContainer = document.getElementById('app');
    const sidebar = document.getElementById('sidebar');
    const header = document.getElementById('app-header');

    appContainer.classList.remove('hidden');

    const createMenuItem = (v, i, t) => `<li><a href="#" data-view="${v}" class="flex items-center p-2 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white group transition-colors"><i data-lucide="${i}" class="w-5 h-5"></i><span class="ml-3">${t}</span></a></li>`;
    const createLogoutItem = () => `<li class="pt-2 mt-2 border-t border-slate-700"><button data-action="logout" class="w-full flex items-center p-2 text-red-400 rounded-lg hover:bg-red-500 hover:text-white group transition-colors"><i data-lucide="log-out" class="w-5 h-5"></i><span class="ml-3">Sair</span></button></li>`;

    let menuHTML = '';
    if (user.role === 'vendedor') {
        menuHTML = createMenuItem('caixa', 'shopping-basket', 'Caixa') +
                   createMenuItem('pedidos', 'list-ordered', 'Pedidos') +
                   createMenuItem('metas', 'target', 'Metas') +
                   createMenuItem('ranking', 'trophy', 'Ranking') +
                   createMenuItem('dashboard', 'layout-dashboard', 'Dashboard') +
                   createLogoutItem();
    } else { // Gerente e Super Admin
        menuHTML = createMenuItem('dashboard', 'layout-dashboard', 'Dashboard') +
                   createMenuItem('financeiro', 'dollar-sign', 'Financeiro') +
                   createMenuItem('pedidos', 'list-ordered', 'Pedidos') +
                   createMenuItem('clientes', 'users', 'Clientes') +
                   createMenuItem('produtos', 'package', 'Produtos') +
                   createMenuItem('ranking', 'trophy', 'Ranking') +
                   createMenuItem('configuracoes', 'settings', 'Configurações') +
                   createLogoutItem();
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
                <button id="mobile-menu-button" class="sm:hidden text-slate-600 dark:text-slate-300">
                    <i data-lucide="menu" class="w-6 h-6"></i>
                </button>
                <h2 id="current-view-title" class="text-xl font-bold text-slate-900 dark:text-white"></h2>
            </div>
            <div class="flex items-center gap-4">
                ${user.role === 'superadmin' ? `
                <div id="store-switcher-container">
                    <select id="store-switcher-select" class="block w-full rounded-md border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 text-sm py-1.5">
                        ${allStores.map(s => `<option value="${s.id}" ${s.id === store.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </select>
                </div>` : ''}
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

/**
 * Renderiza o conteúdo de uma view específica.
 * @param {string} viewId - O ID da view.
 * @param {object} [options={}] - Opções para a renderização da view.
 */
export function renderView(viewId, options = {}) {
    const mainContent = document.getElementById('main-content');
    const viewTitle = document.getElementById('current-view-title');
    const link = document.querySelector(`#sidebar a[data-view="${viewId}"]`);

    if (link) {
        viewTitle.textContent = link.querySelector('span').textContent;
        document.querySelectorAll('#sidebar ul li a').forEach(l => l.classList.remove('bg-slate-700', 'text-white'));
        link.classList.add('bg-slate-700', 'text-white');
    }

    // O conteúdo HTML agora será injetado pelos módulos específicos (sales.js, products.js, etc.)
    // Esta função apenas prepara o terreno.
    mainContent.innerHTML = `<div id="${viewId}-view" class="view active fade-in"></div>`;
}

export function clearApp() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('sidebar').innerHTML = '';
    document.getElementById('app-header').innerHTML = '';
    document.getElementById('main-content').innerHTML = '';
}

export function renderAppLoading() {
    const appContainer = document.getElementById('app');
    appContainer.classList.remove('hidden');
    appContainer.innerHTML = '<div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-primary mx-auto mt-20"></div>';
}

// --- Funções de UI Utilitárias ---

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
    // Re-attach listeners as login/app screens might be re-rendered
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('#theme-toggle-login') || e.target.closest('#theme-toggle-app')) {
            handler();
        }
    });
}