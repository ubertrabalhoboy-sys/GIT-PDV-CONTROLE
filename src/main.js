import { listenForAuthStateChanges, logout, login, setSelectedStore } from './auth.js';
import { renderAppShell, _renderUserSelection, _renderPasswordView, _renderStoreSelection } from './ui.js';
import { getStores, getUsersForStore, getInitialAdminUser } from './firebaseApi.js';

async function initializeApp(user, initialStore) { /* ...código da função... */ }

function setupGlobalEventListeners(initialStores) {
    let selectedUserForLogin = null;
    let selectedStoreForLogin = initialStores.length === 1 ? initialStores[0] : null;

    document.body.addEventListener('click', async (e) => {
        const userButton = e.target.closest('button[data-username]');
        if (userButton) {
            const usersInStore = await getUsersForStore(selectedStoreForLogin?.id);
            const superAdminUser = await getInitialAdminUser();
            let allAvailableUsers = [...usersInStore];
            if (superAdminUser && !allAvailableUsers.some(u => u.id === superAdminUser.id)) {
                allAvailableUsers.push(superAdminUser);
            }
            selectedUserForLogin = allAvailableUsers.find(u => u.id === userButton.dataset.userid);
            if (selectedUserForLogin) { _renderPasswordView(selectedUserForLogin); }
            return;
        }

        const storeButton = e.target.closest('button[data-store-id]');
        if (storeButton) {
            selectedStoreForLogin = initialStores.find(s => s.id === storeButton.dataset.storeId);
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
            if (!selectedUserForLogin) return;
            
            try {
                if (!selectedStoreForLogin) {
                    selectedStoreForLogin = initialStores.length > 0 ? initialStores[0] : null;
                    if (!selectedStoreForLogin) throw new Error("Nenhuma loja configurada.");
                }
                await login(selectedUserForLogin.name, passwordInput.value);
                setSelectedStore(selectedStoreForLogin);
            } catch (error) {
                if(errorP) errorP.textContent = error.message;
            }
        }
    });
}

async function onDomReady() {
    const initialStores = await getStores();
    setupGlobalEventListeners(initialStores);
    listenForAuthStateChanges(initializeApp);
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', onDomReady); } else { onDomReady(); }