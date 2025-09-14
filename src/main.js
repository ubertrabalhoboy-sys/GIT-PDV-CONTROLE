// Substitua todo o conteúdo de src/main.js por este

import { listenForAuthStateChanges, logout, login, getCurrentUser, getSelectedStore, setSelectedStore } from './auth.js';
import { renderAppShell, renderView, showMobileMenu, applyTheme, setupThemeToggle, _renderUserSelection, _renderPasswordView, _renderStoreSelection } from './ui.js';
import { getStores, getUsersForStore, getSettings } from './firebaseApi.js';
import { DEBUG } from './utils.js';

const appState = {
    currentView: null,
};

/**
 * Navega para uma nova view, renderizando seu conteúdo.
 */
async function switchView(viewId) {
    if (DEBUG) console.log(`Switching view to: ${viewId}`);
    appState.currentView = viewId;
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '<div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-primary mx-auto mt-20"></div>';

    const user = getCurrentUser();
    const store = getSelectedStore();

    if (!user || !store) {
        console.error("User or store not available for view rendering.");
        logout();
        return;
    }
    
    // Lazy-loading for modules
    switch (viewId) {
        case 'caixa':
            const { initCaixaView } = await import('./sales.js');
            await initCaixaView();
            break;
        case 'produtos':
            const { initProductsView } = await import('./products.js');
            await initProductsView();
            break;
        // Adicione outros casos de view aqui...
        default:
            renderView(viewId);
            break;
    }
    showMobileMenu(false);
}

/**
 * Inicializa a aplicação principal após o login.
 */
async function initializeApp(user, initialStore) {
    if (DEBUG) console.log("Initializing app for user:", user.name, "at store:", initialStore.name);
    
    const stores = user.role === 'superadmin' ? await getStores() : null;
    renderAppShell(user, initialStore, stores);

    document.getElementById('sidebar')?.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-view]');
        const logoutBtn = e.target.closest('button[data-action="logout"]');
        if (link) { e.preventDefault(); switchView(link.dataset.view); }
        if (logoutBtn) { logout(); }
    });
    
    document.getElementById('mobile-menu-button')?.addEventListener('click', () => showMobileMenu(true));
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => showMobileMenu(false));

    document.getElementById('store-switcher-select')?.addEventListener('change', async (e) => {
        const newStoreId = e.target.value;
        const allStores = await getStores();
        const newStore = allStores.find(s => s.id === newStoreId);
        if (newStore) {
            setSelectedStore(newStore);
            initializeApp(user, newStore);
        }
    });

    const initialView = user.role === 'vendedor' ? 'caixa' : 'dashboard';
    await switchView(initialView);
}

/**
 * NOVO: Gerencia todos os cliques e envios de formulário do corpo do documento.
 * Esta é uma abordagem mais robusta que funciona independentemente de quando a UI é renderizada.
 */
function setupGlobalEventListeners() {
    let selectedUserForLogin = null;
    let selectedStoreForLogin = null;

    document.body.addEventListener('click', async (e) => {
        // Botão de seleção de loja
        const storeButton = e.target.closest('button[data-store-id]');
        if (storeButton) {
            const stores = await getStores();
            selectedStoreForLogin = stores.find(s => s.id === storeButton.dataset.storeId);
            const users = await getUsersForStore(selectedStoreForLogin.id);
            _renderUserSelection(users);
            return;
        }

        // Botão de seleção de usuário
        const userButton = e.target.closest('button[data-username]');
        if (userButton) {
             const allUsersForStore = await getUsersForStore(selectedStoreForLogin?.id);
             const superAdmin = await getUsersForStore(null, true);
             const combinedUsers = [...allUsersForStore, ...superAdmin];
             selectedUserForLogin = combinedUsers.find(u => u.id === userButton.dataset.userid);
             _renderPasswordView(selectedUserForLogin);
             return;
        }

        // Botão "Voltar para Lojas"
        const backToStores = e.target.closest('#back-to-stores');
        if (backToStores) {
            selectedStoreForLogin = null;
            _renderStoreSelection(await getStores());
            return;
        }
        
        // Botão "Voltar para Usuários"
        const backToUsers = e.target.closest('#back-to-users');
        if (backToUsers) {
             _renderUserSelection(await getUsersForStore(selectedStoreForLogin.id));
             return;
        }
    });

    document.body.addEventListener('submit', async (e) => {
        // Formulário de senha
        if (e.target.id === 'password-form') {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const errorP = document.getElementById('login-error');
            const formBox = document.getElementById('main-login-box');
            
            errorP.textContent = '';
            
            try {
                const userProfile = await login(selectedUserForLogin.name, password);
                
                if (userProfile.role === 'superadmin' && !selectedStoreForLogin) {
                    const stores = await getStores();
                    selectedStoreForLogin = stores[0];
                }
                
                if (!selectedStoreForLogin) throw new Error("Loja não selecionada.");

                const settings = await getSettings(selectedStoreForLogin.id);
                selectedStoreForLogin.settings = settings;

                setSelectedStore(selectedStoreForLogin);
                // O onAuthStateChanged vai cuidar da transição para o app
            } catch (error) {
                errorP.textContent = error.message;
                formBox.classList.add('animate-shake');
                setTimeout(() => formBox.classList.remove('animate-shake'), 500);
            }
        }
    });
}

/**
 * Função de inicialização do documento.
 */
function onDomReady() {
    const theme = localStorage.getItem('theme') || 'dark';
    applyTheme(theme);
    setupThemeToggle(() => {
        if (['dashboard', 'financeiro'].includes(appState.currentView)) {
            switchView(appState.currentView);
        }
    });
    
    // Configura os listeners globais uma única vez
    setupGlobalEventListeners();
    
    // Inicia o fluxo de autenticação
    listenForAuthStateChanges(initializeApp);

    if (DEBUG) {
        import('./dev-sanity-check.js').then(module => module.runChecks());
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomReady);
} else {
    onDomReady();
}