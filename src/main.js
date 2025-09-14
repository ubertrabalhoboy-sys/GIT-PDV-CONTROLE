import { listenForAuthStateChanges, logout, login, getCurrentUser, getSelectedStore, setSelectedStore } from './auth.js';
import { renderAppShell, renderView, showMobileMenu, applyTheme, setupThemeToggle, _renderUserSelection, _renderPasswordView, _renderStoreSelection } from './ui.js';
import { getStores, getUsersForStore, getSettings, getInitialAdminUser } from './firebaseApi.js';
import { DEBUG } from './utils.js';

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

// Em src/main.js, substitua a função setupGlobalEventListeners inteira por esta versão final:

function setupGlobalEventListeners(initialStores) {
    let selectedUserForLogin = null;
    let selectedStoreForLogin = initialStores.length === 1 ? initialStores[0] : null;

    document.body.addEventListener('click', async (e) => {
        // Lógica para o botão de usuário (já está funcionando)
        const userButton = e.target.closest('button[data-username]');
        if (userButton) {
            const usersInStore = await getUsersForStore(selectedStoreForLogin?.id);
            const superAdminUser = await getInitialAdminUser();
            
            let allAvailableUsers = [...usersInStore];
            if (superAdminUser && !allAvailableUsers.some(u => u.id === superAdminUser.id)) {
                allAvailableUsers.push(superAdminUser);
            }

            selectedUserForLogin = allAvailableUsers.find(u => u.id === userButton.dataset.userid);
            
            if (selectedUserForLogin) {
                _renderPasswordView(selectedUserForLogin);
            } else {
                console.error("ERRO: Usuário clicado não foi encontrado.");
            }
            return;
        }

        // Lógica para o botão de loja
        const storeButton = e.target.closest('button[data-store-id]');
        if (storeButton) {
            selectedStoreForLogin = initialStores.find(s => s.id === storeButton.dataset.storeId);
            const users = await getUsersForStore(selectedStoreForLogin.id);
            _renderUserSelection(users, selectedStoreForLogin);
            return;
        }

        // --- INÍCIO DA CORREÇÃO ---
        // Adiciona a lógica que faltava para os botões "Voltar"
        const backToUsers = e.target.closest('#back-to-users');
        if (backToUsers) {
             const users = await getUsersForStore(selectedStoreForLogin.id);
             _renderUserSelection(users, selectedStoreForLogin);
             return;
        }

        const backToStores = e.target.closest('#back-to-stores');
        if (backToStores) {
            selectedStoreForLogin = null;
            _renderStoreSelection(initialStores);
            return;
        }
        // --- FIM DA CORREÇÃO ---
    });
    
    document.body.addEventListener('submit', async (e) => {
        if (e.target.id === 'password-form') {
            e.preventDefault();
            const passwordInput = document.getElementById('password');
            const password = passwordInput.value;
            const errorP = document.getElementById('login-error');
            const formBox = document.getElementById('main-login-box');
            
            if (!selectedUserForLogin) {
                console.error("Tentativa de login sem usuário selecionado.");
                return;
            }

            passwordInput.disabled = true;
            if(errorP) errorP.textContent = 'Verificando...';
            
            try {
                if (!selectedStoreForLogin) {
                    const stores = await getStores();
                    if(stores.length > 0) selectedStoreForLogin = stores[0];
                    else throw new Error("Nenhuma loja configurada.");
                }
                await login(selectedUserForLogin.name, password);
                setSelectedStore(selectedStoreForLogin);
                // O onAuthStateChanged cuidará da transição para o app
            } catch (error) {
                if(errorP) errorP.textContent = error.message;
                if(formBox) {
                    formBox.classList.add('animate-shake');
                    setTimeout(() => formBox.classList.remove('animate-shake'), 500);
                }
            } finally {
                passwordInput.disabled = false;
            }
        }
    });
}