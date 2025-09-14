/**
 * Ponto de entrada principal da aplicação PDV.
 * Responsável por inicializar os módulos, gerenciar o estado de autenticação e
 * orquestrar a navegação e a renderização das views.
 *
 * @file Ficheiro principal que arranca a aplicação.
 * @summary Este ficheiro lida com o fluxo de autenticação, carrega módulos dinamicamente
 * e anexa os principais event listeners da aplicação.
 * @description
 * - SYSTEM SPEC: multi-store isolation; roles (Vendedor, Gerente, Super Admin);
 * - limit DB reads to pages of 15; email pattern `username@pdv-app.com`; persist auth.
 */

import { listenForAuthStateChanges, logout, getCurrentUser, getSelectedStore, setSelectedStore } from './auth.js';
import { renderAppShell, renderView, showMobileMenu, applyTheme, setupThemeToggle } from './ui.js';
import { getStores } from './firebaseApi.js';
import { DEBUG } from './utils.js';

const appState = {
    currentView: null,
};

/**
 * Navega para uma nova view, renderizando seu conteúdo.
 * Utiliza importação dinâmica (lazy-loading) para módulos de view maiores.
 * @param {string} viewId - O ID da view para a qual navegar (ex: 'caixa', 'produtos').
 */
async function switchView(viewId) {
    if (DEBUG) console.log(`Switching view to: ${viewId}`);
    appState.currentView = viewId;
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '<div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-primary mx-auto mt-20"></div>'; // Loading spinner

    const user = getCurrentUser();
    const store = getSelectedStore();

    if (!user || !store) {
        console.error("User or store not available for view rendering.");
        logout();
        return;
    }

    // Lazy-loading for heavier modules
    switch (viewId) {
        case 'caixa':
            const { initCaixaView } = await import('./sales.js');
            await initCaixaView();
            break;
        case 'produtos':
            const { initProductsView } = await import('./products.js');
            await initProductsView();
            break;
        case 'clientes':
            const { initClientsView } = await import('./clients.js');
            await initClientsView();
            break;
        case 'pedidos':
            const { initPedidosView } = await import('./sales.js');
            await initPedidosView();
            break;
        case 'dashboard':
        case 'relatorios': // Alias
            const { initDashboardView } = await import('./dashboard.js');
            await initDashboardView();
            break;
        case 'financeiro':
            const { initFinanceiroView } = await import('./finance.js');
            await initFinanceiroView();
            break;
        // Views mais simples podem ser renderizadas diretamente pelo ui.js
        default:
            renderView(viewId);
            break;
    }
    showMobileMenu(false);
}

/**
 * Inicializa a aplicação principal após o login bem-sucedido.
 * Renderiza o shell da aplicação e configura a navegação.
 * @param {object} user - O objeto do usuário autenticado.
 * @param {object} initialStore - A loja selecionada inicialmente.
 */
async function initializeApp(user, initialStore) {
    if (DEBUG) console.log("Initializing app for user:", user.name, "at store:", initialStore.name);
    
    // Renderiza a estrutura principal da UI (sidebar, header)
    const stores = user.role === 'superadmin' ? await getStores() : null;
    renderAppShell(user, initialStore, stores);

    // Configura listeners de eventos do shell
    document.getElementById('sidebar')?.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-view]');
        const logoutBtn = e.target.closest('button[data-action="logout"]');
        if (link) {
            e.preventDefault();
            switchView(link.dataset.view);
        }
        if (logoutBtn) {
            logout();
        }
    });
    
    document.getElementById('mobile-menu-button')?.addEventListener('click', () => showMobileMenu(true));
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => showMobileMenu(false));

    document.getElementById('store-switcher-select')?.addEventListener('change', async (e) => {
        const newStoreId = e.target.value;
        const allStores = await getStores();
        const newStore = allStores.find(s => s.id === newStoreId);
        if (newStore) {
            setSelectedStore(newStore);
            initializeApp(user, newStore); // Re-initialize with the new store
        }
    });

    // Define a view inicial com base na função do usuário
    const initialView = user.role === 'vendedor' ? 'caixa' : 'dashboard';
    await switchView(initialView);
}

/**
 * Função de inicialização do documento.
 * Configura o tema e inicia o listener de estado de autenticação.
 */
function onDomReady() {
    // Configuração inicial do tema
    const theme = localStorage.getItem('theme') || 'dark';
    applyTheme(theme);
    setupThemeToggle(() => {
        // Re-render view if it contains charts that need theme updates
        if (['dashboard', 'financeiro'].includes(appState.currentView)) {
            switchView(appState.currentView);
        }
    });
    
    // Inicia o fluxo de autenticação
    listenForAuthStateChanges(initializeApp);

    // Inicia o sanity check em modo de desenvolvimento
    if (DEBUG) {
        import('./dev-sanity-check.js').then(module => module.runChecks());
    }
}

// Garante que o DOM está pronto antes de executar o script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomReady);
} else {
    onDomReady();
}