/**
 * Módulo de Autenticação e Gestão de Sessão.
 * Lida com login, logout, persistência de sessão e seleção de loja/usuário.
 *
 * @file Módulo para todas as operações relacionadas com o utilizador.
 * @summary Gere o ciclo de vida da autenticação, incluindo a seleção inicial de loja e utilizador.
 * @description
 * - SYSTEM SPEC: multi-store isolation; roles (Vendedor, Gerente, Super Admin);
 * - limit DB reads to pages of 15; email pattern `username@pdv-app.com`; persist auth.
 */
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from './firebaseConfig.js';
import { getStores, getUsersForStore, getUserProfile, getSettings, getInitialAdminUser } from './firebaseApi.js';
import { renderLoginScreen, clearLoginScreen, renderAppLoading, clearApp } from './ui.js';
import { DEBUG } from "./utils.js";

// State local to the auth module
let currentUser = null;
let selectedStore = null;

/**
 * @returns {object|null} O objeto do usuário atualmente logado.
 */
export const getCurrentUser = () => currentUser;

/**
 * @returns {object|null} A loja atualmente selecionada.
 */
export const getSelectedStore = () => selectedStore;

/**
 * Define a loja selecionada. Usado pelo seletor de lojas do superadmin.
 * @param {object} store - O objeto da loja.
 */
export const setSelectedStore = (store) => {
    selectedStore = store;
    sessionStorage.setItem('selectedStore', JSON.stringify(store));
};


/**
 * Tenta fazer login de um usuário usando nome de usuário e senha.
 * O nome de usuário é convertido para o formato de e-mail esperado pelo Firebase Auth.
 * @param {string} username - O nome de usuário.
 * @param {string} password - A senha.
 * @returns {Promise<object>} O objeto do usuário logado.
 * @throws {Error} Se o login falhar.
 */
export async function login(username, password) {
    const email = `${username.toLowerCase().replace(/\s+/g, '')}@pdv-app.com`;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userProfile = await getUserProfile(userCredential.user.uid);
        if (!userProfile) throw new Error("User profile not found in Firestore.");

        currentUser = userProfile;
        
        // Se o usuário não for superadmin, a loja já está definida no seu perfil
        if (userProfile.role !== 'superadmin') {
            const allStores = await getStores();
            selectedStore = allStores.find(s => s.id === userProfile.storeId);
        }
        
        // Armazena na sessionStorage para persistência entre reloads da aba
        sessionStorage.setItem('selectedStore', JSON.stringify(selectedStore));

        return userProfile;
    } catch (error) {
        console.error("Login failed:", error.code);
        throw new Error("Senha inválida.");
    }
}

/**
 * Faz logout do usuário atual, limpa o estado da aplicação e a UI.
 */
export async function logout() {
    try {
        await firebaseSignOut(auth);
        if (DEBUG) console.log("User signed out successfully.");
    } catch (error) {
        console.error("Sign out failed:", error);
    } finally {
        // Limpa estado e UI independentemente do sucesso do logout do Firebase
        currentUser = null;
        selectedStore = null;
        sessionStorage.removeItem('selectedStore');
        sessionStorage.removeItem('lastUserUID');
        clearApp();
        startLoginFlow();
    }
}

/**
 * Inicia o fluxo de login, começando pela busca das lojas disponíveis.
 */
async function startLoginFlow() {
    clearLoginScreen(); // Limpa qualquer estado anterior
    try {
        let stores = await getStores();
        // Se não houver lojas, pode ser a primeira execução. O Super Admin precisa logar.
        if (stores.length === 0) {
            const adminUser = await getInitialAdminUser();
            if (adminUser) {
                 renderLoginScreen([], [adminUser]); // Renderiza direto a seleção de usuário
            } else {
                 renderLoginScreen([], [], true); // Mostra estado de "primeira execução"
            }
            return;
        }
        
        // Em vez de renderizar a lista de lojas, tentamos encontrar o superadmin
        // para simplificar o fluxo de login em sistemas de loja única ou onde
        // os usuários já são pré-atribuídos.
        const allUsers = [];
        for (const store of stores) {
            const users = await getUsersForStore(store.id);
            allUsers.push(...users);
        }
        
        // Se houver usuários, renderiza a seleção de usuários
        if (allUsers.length > 0) {
            renderLoginScreen(stores, allUsers);
        } else {
            // Nenhuma loja e nenhum usuário, mostra a tela de primeira execução
            renderLoginScreen([], [], true);
        }

    } catch (error) {
        console.error("Error starting login flow:", error);
        renderLoginScreen([], [], false, "Erro ao carregar dados iniciais.");
    }
}


/**
 * Escuta por mudanças no estado de autenticação do Firebase.
 * Este é o ponto central que decide se mostra a tela de login ou a aplicação.
 * @param {function} onLoginSuccess - Callback a ser executado quando um usuário está logado.
 */
// Cole este código NO LUGAR da função listenForAuthStateChanges existente em src/auth.js

/**
 * Escuta por mudanças no estado de autenticação do Firebase.
 * Este é o ponto central que decide se mostra a tela de login ou a aplicação.
 * @param {function} onLoginSuccess - Callback a ser executado quando um usuário está logado.
 */
export function listenForAuthStateChanges(onLoginSuccess) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Usuário está logado na sessão do Firebase
            if (DEBUG) console.log("Auth state changed: User is logged in.", user.uid);

            // --- INÍCIO DA CORREÇÃO ---
            // Agora, antes de validar, nós definimos o UID na sessão da aba se não estiver lá.
            sessionStorage.setItem('lastUserUID', user.uid);

            const storedStoreJSON = sessionStorage.getItem('selectedStore');

            if (storedStoreJSON) {
                selectedStore = JSON.parse(storedStoreJSON);
                const userProfile = await getUserProfile(user.uid);
                currentUser = userProfile;

                if (userProfile && selectedStore) {
                    const settings = await getSettings(selectedStore.id);
                    selectedStore.settings = settings; // Anexa as configurações à loja
                    clearLoginScreen();
                    onLoginSuccess(currentUser, selectedStore);
                    return; // Fim do fluxo de sucesso
                }
            }

            // Se não houver loja na sessão (ex: aba nova), forçamos o logout para
            // que o usuário possa selecionar a loja novamente de forma limpa.
            if (DEBUG) console.log("No valid store found in session. Forcing re-login to select store.");
            await logout();
            // --- FIM DA CORREÇÃO ---

        } else {
            // Usuário não está logado
            if (DEBUG) console.log("Auth state changed: User is logged out.");
            currentUser = null;
            selectedStore = null;
            sessionStorage.removeItem('selectedStore');
            sessionStorage.removeItem('lastUserUID');
            clearApp();
            startLoginFlow();
        }
    });
}