// Garanta que o conteúdo de src/main.js seja este:

import { listenForAuthStateChanges, logout, login, getCurrentUser, getSelectedStore, setSelectedStore } from './auth.js';
import { renderAppShell, renderView, showMobileMenu, applyTheme, setupThemeToggle, _renderUserSelection, _renderPasswordView, _renderStoreSelection } from './ui.js';
import { getStores, getUsersForStore, getSettings } from './firebaseApi.js';
import { DEBUG } from './utils.js';

// --- PONTO DE TESTE 1 ---
console.log("Mensagem 1: O arquivo main.js foi carregado e está sendo executado.");

const appState = { currentView: null };

async function switchView(viewId) { /* ...código da função... */ }
async function initializeApp(user, initialStore) { /* ...código da função... */ }

// Em src/main.js, substitua a função setupGlobalEventListeners inteira por esta:

function setupGlobalEventListeners(initialStores) {
    console.log("Mensagem 2: A função setupGlobalEventListeners foi chamada. O sistema está pronto para ouvir cliques.");

    let selectedUserForLogin = null;
    let selectedStoreForLogin = initialStores.length === 1 ? initialStores[0] : null;

    document.body.addEventListener('click', async (e) => {
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
            
            // --- INÍCIO DA CORREÇÃO ---
            // Lógica simplificada e corrigida para encontrar o usuário clicado
            const usersInStore = await getUsersForStore(selectedStoreForLogin?.id);
            const superAdminUser = await getInitialAdminUser();
            
            let allAvailableUsers = [...usersInStore];
            if (superAdminUser && !allAvailableUsers.some(u => u.id === superAdminUser.id)) {
                allAvailableUsers.push(superAdminUser);
            }

            selectedUserForLogin = allAvailableUsers.find(u => u.id === userButton.dataset.userid);
            
            console.log("Usuário selecionado para login:", selectedUserForLogin);

            if (selectedUserForLogin) {
                _renderPasswordView(selectedUserForLogin);
            } else {
                console.error("ERRO: Usuário clicado não foi encontrado na lista de usuários disponíveis.");
            }
            // --- FIM DA CORREÇÃO ---
            return;
        }
        
        const backToStores = e.target.closest('#back-to-stores');
        if (backToStores) { /* ...código... */ return; }
        
        const backToUsers = e.target.closest('#back-to-users');
        if (backToUsers) { /* ...código... */ return; }

        console.log("Mensagem 5: O clique não correspondeu a nenhum botão conhecido.");
    });
    
    // A lógica do 'submit' continua a mesma
    document.body.addEventListener('submit', async (e) => {
        if (e.target.id === 'password-form') {
            e.preventDefault();
            const passwordInput = document.getElementById('password');
            const password = passwordInput.value;
            const errorP = document.getElementById('login-error');
            const formBox = document.getElementById('main-login-box');
            
            passwordInput.disabled = true;
            errorP.textContent = '';
            
            try {
                const userProfile = await login(selectedUserForLogin.name, password);
                
                if (userProfile.role === 'superadmin' && !selectedStoreForLogin) {
                    selectedStoreForLogin = initialStores[0];
                }
                
                if (!selectedStoreForLogin) throw new Error("Loja não selecionada.");

                const settings = await getSettings(selectedStoreForLogin.id);
                selectedStoreForLogin.settings = settings;

                setSelectedStore(selectedStoreForLogin);
            } catch (error) {
                errorP.textContent = error.message;
                formBox.classList.add('animate-shake');
                setTimeout(() => formBox.classList.remove('animate-shake'), 500);
            } finally {
                passwordInput.disabled = false;
            }
        }
    });
}