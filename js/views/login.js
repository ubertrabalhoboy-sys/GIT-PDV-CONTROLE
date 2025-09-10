// js/views/login.js

import { state, uiState } from '../state.js';
import { getStores, getUsersForStore, getSettings, createDefaultSettings } from '../services/dataService.js';
import { showToast } from '../utils/domUtils.js';

function renderStoreSelection() {
    const storeList = document.getElementById('store-list');
    storeList.innerHTML = '';
    state.db.stores.forEach(store => {
        const storeButton = document.createElement('button');
        storeButton.className = 'w-full text-left p-4 custom-card rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors duration-200';
        storeButton.dataset.storeId = store.id;
        storeButton.dataset.storeName = store.name;
        storeButton.textContent = store.name;
        storeList.appendChild(storeButton);
    });
}

async function loadUsersForStore(storeId) {
    try {
        const [usersSnapshot, superAdminSnapshot] = await getUsersForStore(storeId);
        const usersMap = new Map();

        usersSnapshot.docs.forEach(doc => {
            usersMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
        superAdminSnapshot.docs.forEach(doc => {
            usersMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        state.db.users = Array.from(usersMap.values());

        const userList = document.getElementById('user-list');
        userList.innerHTML = '';
        if (state.db.users.length > 0) {
            state.db.users.forEach(user => {
                const userButton = document.createElement('button');
                userButton.className = 'flex flex-col items-center p-4 custom-card rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors duration-200 transform hover:scale-105';
                userButton.dataset.username = user.name;
                userButton.innerHTML = `<div class="w-16 h-16 mb-2 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 text-3xl font-bold">${user.name.charAt(0).toUpperCase()}</div><span class="font-semibold text-slate-800 dark:text-slate-200 text-center">${user.name}</span>`;
                userList.appendChild(userButton);
            });
        } else {
            userList.innerHTML = '<p class="col-span-full text-center text-slate-500">Nenhum usuário para esta loja.</p>';
        }

        document.getElementById('store-selection-view').classList.add('hidden');
        document.getElementById('user-selection-view').classList.remove('hidden');
    } catch (error) {
        console.error("Erro ao carregar usuários:", error);
        showToast('Falha ao carregar usuários.', 'error');
    }
}

export async function handleStoreSelection(storeButton) {
    state.selectedStore = {
        id: storeButton.dataset.storeId,
        name: storeButton.dataset.storeName
    };

    const settingsSnap = await getSettings(state.selectedStore.id);

    if (settingsSnap.exists()) {
        state.db.settings = { ...state.db.settings, ...settingsSnap.data() };
    } else {
        const defaultSettings = {
            storeName: state.selectedStore.name,
            goals: { daily: 150, weekly: 1000, monthly: 4000 },
            bonusSystem: { enabled: true, value: 80 },
            bonusWheel: { enabled: false, prizes: [], minValue: 0 },
            ownerPhone: ''
        };
        state.db.settings = { ...state.db.settings, ...defaultSettings };
        await createDefaultSettings(state.selectedStore.id, state.selectedStore.name);
    }

    loadUsersForStore(state.selectedStore.id);
}

export function handleUserSelection(userButton) {
    uiState.selectedUserForLogin = userButton.dataset.username;
    document.getElementById('user-selection-view').classList.add('hidden');
    document.getElementById('password-view').classList.remove('hidden');
    document.getElementById('selected-user-info').innerHTML = `<div class="w-20 h-20 mx-auto mb-3 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 text-4xl font-bold">${uiState.selectedUserForLogin.charAt(0).toUpperCase()}</div><h3 class="text-xl font-bold text-slate-900 dark:text-white">${uiState.selectedUserForLogin}</h3>`;
    document.getElementById('password').value = '';
    document.getElementById('password').focus();
}

export async function loadInitialData() {
    // Esconde todas as telas de login/setup
    document.getElementById('first-run-view').classList.add('hidden');
    document.getElementById('store-selection-view').classList.add('hidden');
    document.getElementById('user-selection-view').classList.add('hidden');
    document.getElementById('password-view').classList.add('hidden');

    try {
        const storesSnapshot = await getStores();

        if (storesSnapshot.empty) {
            // Lógica para primeira execução do sistema
            document.getElementById('first-run-view').classList.remove('hidden');
            document.getElementById('first-run-view').innerHTML = '<p class="text-slate-500 dark:text-slate-400 mb-6 text-center">Configurando o sistema pela primeira vez, por favor aguarde...</p><div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-primary mx-auto"></div>';
            
            // Cria a loja inicial (função foi movida para dataService, mas a lógica de UI permanece aqui)
            // A lógica de criação real seria chamada pelo main.js, aqui apenas simulamos o resultado
            showToast('Sistema pronto! Faça login com o superadmin criado no console.', 'success');
            // Após a criação, o sistema deve ser recarregado para mostrar a seleção de loja.
            window.location.reload(); 
        } else {
            state.db.stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderStoreSelection();
            document.getElementById('store-selection-view').classList.remove('hidden');
        }
    } catch (error) {
        console.error("Erro ao carregar lojas:", error);
        showToast('Falha ao carregar lojas.', 'error');
    }
}