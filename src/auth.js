// Substitua todo o conteúdo de src/auth.js por este:

import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from './firebaseConfig.js';
import { getStores, getUsersForStore, getUserProfile, getSettings, getInitialAdminUser } from './firebaseApi.js';
import { renderLoginScreen, clearLoginScreen, clearApp } from './ui.js';
import { DEBUG } from "./utils.js";

let currentUser = null;
let selectedStore = null;

export const getCurrentUser = () => currentUser;
export const getSelectedStore = () => selectedStore;
export const setSelectedStore = (store) => {
    selectedStore = store;
    sessionStorage.setItem('selectedStore', JSON.stringify(store));
};

export async function login(username, password) { /* ...código da função... */ }
export async function logout() { /* ...código da função... */ }

async function startLoginFlow() {
    // --- PONTO DE TESTE D ---
    console.log("Mensagem D: A função startLoginFlow em auth.js foi chamada.");
    clearLoginScreen();
    try {
        console.log("Mensagem E: Buscando lojas do Firebase...");
        let stores = await getStores();
        console.log("Mensagem F: Lojas encontradas:", stores);

        if (stores.length === 0) {
            console.log("Mensagem G: Nenhuma loja encontrada, procurando por superadmin...");
            const adminUser = await getInitialAdminUser();
            if (adminUser) {
                 renderLoginScreen([], [adminUser]);
            } else {
                 renderLoginScreen([], [], true);
            }
            console.log("Mensagem H: Tela de primeira execução renderizada.");
            return;
        }
        
        console.log("Mensagem I: Buscando usuários para a(s) loja(s)...");
        const allUsersForStore = stores.length === 1 ? await getUsersForStore(stores[0].id) : [];
        const superAdmin = await getInitialAdminUser();
        const combinedUsers = [...new Map([...allUsersForStore, (superAdmin || {})].filter(u => u.id).map(item => [item['id'], item])).values()];
        console.log("Mensagem J: Usuários encontrados:", combinedUsers);
        
        renderLoginScreen(stores, combinedUsers);
        console.log("Mensagem K: A função renderLoginScreen foi chamada com sucesso.");

    } catch (error) {
        console.error("ERRO CRÍTICO no startLoginFlow:", error);
        renderLoginScreen([], [], false, "Erro ao carregar dados iniciais.");
    }
}

export function listenForAuthStateChanges(onLoginSuccess) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Lógica de usuário logado...
        } else {
            console.log("auth.js: Detectado que o usuário está deslogado. Iniciando fluxo de login...");
            startLoginFlow();
        }
    });
}