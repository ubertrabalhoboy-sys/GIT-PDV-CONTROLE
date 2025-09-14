import { listenForAuthStateChanges, logout, login, setSelectedStore } from './auth.js';
import { _renderUserSelection, _renderPasswordView, _renderStoreSelection, applyTheme, setupThemeToggle } from './ui.js';
import { getStores, getUsersForStore, getInitialAdminUser } from './firebaseApi.js';

function initializeApp(user, store) {
    console.log("Login bem-sucedido! Bem-vindo,", user.name);
    // Aqui entrará a lógica para renderizar o dashboard principal
    const appContainer = document.getElementById('app');
    if (!appContainer) return;
    appContainer.classList.remove('hidden');
    appContainer.innerHTML = `
        <div class="p-8">
            <h1 class="text-2xl font-bold">Bem-vindo, ${user.name}!</h1>
            <p>Loja: ${store.name}</p>
            <button id="logout-btn" class="mt-4 bg-red-500 text-white py-2 px-4 rounded">Sair</button>
        </div>
    `;
    document.getElementById('logout-btn')?.addEventListener('click', logout);
}

function setupGlobalEventListeners(initialStores) {
    let selectedUserForLogin = null;
    let selectedStoreForLogin = initialStores.length === 1 ? initialStores[0] : null;

    document.body.addEventListener('click', async (e) => {
        const userButton = e.target.closest('button[data-username]');
        if (userButton) {
            const users = await getUsersForStore(selectedStoreForLogin?.id);
            const superAdmin = await getInitialAdminUser();
            if (superAdmin) users.push(superAdmin);
            selectedUserForLogin = users.find(u => u.id === userButton.dataset.userid);
            if (selectedUserForLogin) _renderPasswordView(selectedUserForLogin);
            return;
        }

        const storeButton = e.target.closest('button[data-store-id]');
        if (storeButton) {
            selectedStoreForLogin = initialStores.find(s => s.id === storeButton.dataset.storeId);
            const users = await getUsersForStore(selectedStoreForLogin.id);
            _renderUserSelection(users, selectedStoreForLogin);
            return;
        }

        const backToUsers = e.target.closest('#back-to-users');
        if (backToUsers) {
             const users = await getUsersForStore(selectedStoreForLogin.id);
             _renderUserSelection(users, selectedStoreForLogin);
             return;
        }
    });
    
    document.body.addEventListener('submit', async (e) => {
        if (e.target.id === 'password-form') {
            e.preventDefault();
            const passwordInput = document.getElementById('password');
            const errorP = document.getElementById('login-error');
            if (!selectedUserForLogin || !passwordInput || !errorP) return;
            
            errorP.textContent = 'Verificando...';
            try {
                if (!selectedStoreForLogin) {
                    selectedStoreForLogin = initialStores.length > 0 ? initialStores[0] : null;
                    if (!selectedStoreForLogin) throw new Error("Nenhuma loja configurada.");
                }
                await login(selectedUserForLogin.name, passwordInput.value);
                setSelectedStore(selectedStoreForLogin);
            } catch (error) {
                errorP.textContent = error.message;
            }
        }
    });
}

async function onDomReady() {
    applyTheme(localStorage.getItem('theme') || 'dark');
    setupThemeToggle();
    const initialStores = await getStores();
    setupGlobalEventListeners(initialStores);
    listenForAuthStateChanges(initializeApp);
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', onDomReady); } else { onDomReady(); }