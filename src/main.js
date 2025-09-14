// Substitua todo o conteúdo de src/main.js por esta versão de DEPURAÇÃO

import { listenForAuthStateChanges, logout, login, getCurrentUser, getSelectedStore, setSelectedStore } from './auth.js';
import { renderAppShell, renderView, showMobileMenu, applyTheme, setupThemeToggle, _renderUserSelection, _renderPasswordView, _renderStoreSelection } from './ui.js';
import { getStores, getUsersForStore, getSettings } from './firebaseApi.js';
import { DEBUG } from './utils.js';

// --- PONTO DE TESTE 1 ---
console.log("Mensagem 1: O arquivo main.js foi carregado e está sendo executado.");

const appState = {
    currentView: null,
};

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
    switch (viewId) {
        case 'caixa':
            const { initCaixaView } = await import('./sales.js');
            await initCaixaView();
            break;
        case 'produtos':
            const { initProductsView } = await import('./products.js');
            await initProductsView();
            break;
        default:
            renderView(viewId);
            break;
    }
    showMobileMenu(false);
}

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

function setupGlobalEventListeners(initialStores) {
    // --- PONTO DE TESTE 2 ---
    console.log("Mensagem 2: A função setupGlobalEventListeners foi chamada. O sistema está pronto para ouvir cliques.");

    let selectedUserForLogin = null;
    let selectedStoreForLogin = initialStores.length === 1 ? initialStores[0] : null;

    document.body.addEventListener('click', async (e) => {
        // --- PONTO DE TESTE 3 ---
        console.log("Mensagem 3: Clique detectado no corpo da página! Elemento clicado:", e.target);

        const storeButton = e.target.closest('button[data-store-id]');
        if (storeButton) {
            console.log("Mensagem 4: Botão de LOJA foi clicado.");
            selectedStoreForLogin = initialStores.find(s => s.id === storeButton.dataset.storeId);
            const users = await getUsersForStore(selectedStoreForLogin.id);
            _renderUserSelection(users, selectedStoreForLogin);
            return;
        }

        const userButton = e.target.closest('button[data-username]');
        if (userButton) {
            console.log("Mensagem 4: Botão de USUÁRIO foi clicado.");
            const allUsersForStore = await getUsersForStore(selectedStoreForLogin?.id);
            const superAdmin = await getUsersForStore(null, true);
            const combinedUsers = [...new Map([...allUsersForStore, ...superAdmin].map(item => [item['id'], item])).values()];
            selectedUserForLogin = combinedUsers.find(u => u.id === userButton.dataset.userid);
            _renderPasswordView(selectedUserForLogin);
            return;
        }

        console.log("Mensagem 5: O clique não correspondeu a nenhum botão conhecido.");
    });
}

async function onDomReady() {
    console.log("Mensagem A: DOM está pronto.");
    const theme = localStorage.getItem('theme') || 'dark';
    applyTheme(theme);
    setupThemeToggle(() => {});
    
    console.log("Mensagem B: Buscando lojas iniciais...");
    const initialStores = await getStores();
    console.log("Mensagem C: Lojas encontradas:", initialStores);
    
    setupGlobalEventListeners(initialStores);
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