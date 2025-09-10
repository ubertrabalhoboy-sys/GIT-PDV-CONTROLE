import { getDocs, collection, query, where, addDoc, setDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../config/firebase.js';
import { state, updateState, initializeAppUI } from '../../main.js';
import { handleLogin } from '../services/auth.js';
import { showToast } from '../ui/utils.js';

let selectedUserForLogin = null;

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
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("storeId", "==", storeId));
        const superAdminQ = query(usersRef, where("role", "==", "superadmin"));

        const [usersSnapshot, superAdminSnapshot] = await Promise.all([getDocs(q), getDocs(superAdminQ)]);
        const usersMap = new Map();

        usersSnapshot.docs.forEach(doc => usersMap.set(doc.id, { id: doc.id, ...doc.data() }));
        superAdminSnapshot.docs.forEach(doc => usersMap.set(doc.id, { id: doc.id, ...doc.data() }));

        const users = Array.from(usersMap.values());
        updateState({ db: { ...state.db, users } });

        const userList = document.getElementById('user-list');
        userList.innerHTML = '';
        if (users.length > 0) {
            users.forEach(user => {
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

export async function loadInitialData() {
    document.getElementById('first-run-view').classList.add('hidden');
    document.getElementById('store-selection-view').classList.add('hidden');
    document.getElementById('user-selection-view').classList.add('hidden');
    document.getElementById('password-view').classList.add('hidden');

    try {
        const storesSnapshot = await getDocs(query(collection(db, "stores")));

        if (storesSnapshot.empty) {
            document.getElementById('first-run-view').classList.remove('hidden');
            // ... Lógica de primeira execução ...
        }

        const stores = storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateState({ db: { ...state.db, stores } });
        renderStoreSelection();
        document.getElementById('store-selection-view').classList.remove('hidden');
    } catch (error) {
        console.error("Erro ao carregar lojas:", error);
        showToast('Falha ao carregar lojas.', 'error');
    }
}

export function renderLogin() {
    // Event listener para a lista de lojas
    document.getElementById('store-list').addEventListener('click', async (e) => {
        const storeButton = e.target.closest('button');
        if (!storeButton) return;

        const selectedStore = {
            id: storeButton.dataset.storeId,
            name: storeButton.dataset.storeName
        };
        updateState({ selectedStore });

        const settingsRef = doc(db, "settings", selectedStore.id);
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
            updateState({ db: { ...state.db, settings: settingsSnap.data() } });
        }
        
        loadUsersForStore(selectedStore.id);
    });

    // Event listener para a lista de usuários
    document.getElementById('user-selection-view').addEventListener('click', (e) => {
        const userButton = e.target.closest('button');
        if (!userButton || userButton.id === 'back-to-stores') return;

        selectedUserForLogin = userButton.dataset.username;
        document.getElementById('user-selection-view').classList.add('hidden');
        document.getElementById('password-view').classList.remove('hidden');
        document.getElementById('selected-user-info').innerHTML = `<div class="w-20 h-20 mx-auto mb-3 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 text-4xl font-bold">${selectedUserForLogin.charAt(0).toUpperCase()}</div><h3 class="text-xl font-bold text-slate-900 dark:text-white">${selectedUserForLogin}</h3>`;
        document.getElementById('password').value = '';
        document.getElementById('password').focus();
    });

    // Event listener para o formulário de senha
    document.getElementById('password-form').addEventListener('submit', async e => {
        e.preventDefault();
        const user = state.db.users.find(u => u.name.toLowerCase() === selectedUserForLogin.toLowerCase());
        const password = document.getElementById('password').value;
        if (user) {
            await handleLogin(user, password);
        } else {
            showToast('Usuário não encontrado.', 'error');
        }
    });

    // Botões de "Voltar"
    document.getElementById('back-to-stores').addEventListener('click', () => {
        document.getElementById('user-selection-view').classList.add('hidden');
        document.getElementById('store-selection-view').classList.remove('hidden');
        updateState({ selectedStore: null, db: { ...state.db, users: [] } });
    });

    document.getElementById('back-to-users').addEventListener('click', () => {
        selectedUserForLogin = null;
        document.getElementById('password-view').classList.add('hidden');
        document.getElementById('user-selection-view').classList.remove('hidden');
        document.getElementById('login-error').textContent = '';
    });
}
