// Passo 1: Importa o 'db' e 'auth' já prontos do firebase-init.js
import { db, auth } from './firebase-init.js';

// Passo 2: Importa todas as outras funções que seu sistema precisa
import { collection, getDocs, onSnapshot, doc, addDoc, deleteDoc, setDoc, query, where, writeBatch, Timestamp, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    // A inicialização do Firebase foi REMOVIDA daqui.

    // Estado da aplicação
    let state = {
        loggedInUser: null,
        currentView: '',
        currentOrder: [],
        db: {
            users: [],
            stores: [],
            products: [],
            clients: [],
            settings: {
                storeName: "Minha Loja",
                goals: { daily: 150, weekly: 1000, monthly: 4000 },
                commissionSystem: { enabled: true, percentage: 5 },
                bonusWheel: { enabled: false, prizes: [], minValue: 0 },
                ownerPhone: ''
            },
            sales: [],
            fixedCosts: []
        },
        listeners: { users: null, sales: null, stores: null, products: null, clients: null, orders: null, metas: null, ranking: null, relatorios: null, fixedCosts: null },
        selectedStore: null
    };
    let selectedUserForLogin = null;
    let vendasChartInstance = null;
    let pagamentoChartInstance = null;
    let financeiroChartInstance = null; // ADICIONADO: Instância do gráfico financeiro
    let currentRankingPeriod = 'day';

    async function loadInitialData() {
        document.getElementById('first-run-view').classList.add('hidden');
        document.getElementById('store-selection-view').classList.add('hidden');
        document.getElementById('user-selection-view').classList.add('hidden');
        document.getElementById('password-view').classList.add('hidden');

        try {
            const storesQuery = query(collection(db, "stores"));
            const storesSnapshot = await getDocs(storesQuery);

            if (storesSnapshot.empty) {
                document.getElementById('first-run-view').classList.remove('hidden');
                document.getElementById('first-run-view').innerHTML = '<p class="text-slate-500 dark:text-slate-400 mb-6 text-center">Configurando o sistema pela primeira vez, por favor aguarde...</p><div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-primary mx-auto"></div>';

                const storeName = "Loja Principal";

                const storeRef = await addDoc(collection(db, "stores"), { name: storeName });

                await setDoc(doc(db, "settings", storeRef.id), {
                    storeName: storeName,
                    goals: { daily: 150, weekly: 1000, monthly: 4000 },
                    commissionSystem: { enabled: true, percentage: 5 },
                    bonusWheel: { enabled: false, prizes: [], minValue: 0 },
                    ownerPhone: ''
                });
                showToast('Sistema pronto! Faça login com o superadmin criado no console.', 'success');

                const newStoresSnapshot = await getDocs(query(collection(db, "stores")));
                state.db.stores = newStoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderStoreSelection();
                document.getElementById('first-run-view').classList.add('hidden');
                document.getElementById('store-selection-view').classList.remove('hidden');
                return;
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

    function renderStoreSelection() {
        const storeList = document.getElementById('store-list');
        const storeButtonsHTML = state.db.stores.map(store => `
            <button class="w-full text-left p-4 custom-card rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors duration-200" data-store-id="${store.id}" data-store-name="${store.name}">
                ${store.name}
            </button>
        `).join('');
        storeList.innerHTML = storeButtonsHTML;
    }

    document.getElementById('store-list').addEventListener('click', async (e) => {
        const storeButton = e.target.closest('button');
        if (!storeButton) return;

        state.selectedStore = {
            id: storeButton.dataset.storeId,
            name: storeButton.dataset.storeName
        };

        loadUsersForStore(state.selectedStore.id);
    });

    async function loadUsersForStore(storeId) {
        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("storeId", "==", storeId));
            const superAdminQ = query(usersRef, where("role", "==", "superadmin"));

            const [usersSnapshot, superAdminSnapshot] = await Promise.all([getDocs(q), getDocs(superAdminQ)]);

            const usersMap = new Map();

            usersSnapshot.docs.forEach(doc => {
                usersMap.set(doc.id, { id: doc.id, ...doc.data() });
            });

            superAdminSnapshot.docs.forEach(doc => {
                usersMap.set(doc.id, { id: doc.id, ...doc.data() });
            });

            state.db.users = Array.from(usersMap.values());

            const userList = document.getElementById('user-list');
            if (state.db.users.length > 0) {
                const userButtonsHTML = state.db.users.map(user => `
                    <button class="flex flex-col items-center p-4 custom-card rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors duration-200 transform hover:scale-105" data-username="${user.name}">
                        <div class="w-16 h-16 mb-2 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 text-3xl font-bold">${user.name.charAt(0).toUpperCase()}</div>
                        <span class="font-semibold text-slate-800 dark:text-slate-200 text-center">${user.name}</span>
                    </button>
                `).join('');
                userList.innerHTML = userButtonsHTML;
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

    document.getElementById('back-to-stores').addEventListener('click', () => {
        document.getElementById('user-selection-view').classList.add('hidden');
        document.getElementById('store-selection-view').classList.remove('hidden');
        state.selectedStore = null;
        state.db.users = [];
    });

    const applyTheme = (t) => {
        const h = document.documentElement;
        const isDark = t === 'dark';
        h.classList.toggle('dark', isDark);
        ['theme-icon-moon', 'theme-icon-moon-app'].forEach(id => document.getElementById(id)?.classList.toggle('hidden', isDark));
        ['theme-icon-sun', 'theme-icon-sun-app'].forEach(id => document.getElementById(id)?.classList.toggle('hidden', !isDark));
    };
    const formatCurrency = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
    const formatDate = d => {
        if (d && d.toDate) {
            return d.toDate().toLocaleDateString('pt-BR');
        }
        return new Date(d).toLocaleDateString('pt-BR');
    };
    const showToast = (m, t = 'success') => { const e = document.createElement('div'); e.className = `fixed bottom-5 right-5 ${t === 'success' ? 'bg-brand-primary' : (t === 'error' ? 'bg-red-600' : 'bg-slate-600')} text-white py-2 px-4 rounded-lg shadow-lg z-[70] animate-bounce`; e.textContent = m; document.body.appendChild(e); setTimeout(() => e.remove(), 3000) };
    const showConfirmModal = (m, onConfirm) => { const M = document.getElementById('confirm-modal'); M.querySelector('#confirm-modal-message').textContent = m; M.classList.remove('hidden'); const c = M.querySelector('#confirm-modal-confirm'), n = M.querySelector('#confirm-modal-cancel'); const h = () => { onConfirm(); hide() }; const k = () => hide(); const hide = () => { M.classList.add('hidden'); c.removeEventListener('click', h); n.removeEventListener('click', k) }; c.addEventListener('click', h, { once: true }); n.addEventListener('click', k, { once: true }) };

    document.getElementById('user-selection-view').addEventListener('click', (e) => {
        const userButton = e.target.closest('button');
        if (!userButton) return;
        selectedUserForLogin = userButton.dataset.username;
        document.getElementById('user-selection-view').classList.add('hidden');
        document.getElementById('password-view').classList.remove('hidden');
        document.getElementById('selected-user-info').innerHTML = `<div class="w-20 h-20 mx-auto mb-3 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 text-4xl font-bold">${selectedUserForLogin.charAt(0).toUpperCase()}</div><h3 class="text-xl font-bold text-slate-900 dark:text-white">${selectedUserForLogin}</h3>`;
        document.getElementById('password').value = '';
        document.getElementById('password').focus();
    });

    document.getElementById('back-to-users').addEventListener('click', () => {
        selectedUserForLogin = null;
        document.getElementById('password-view').classList.add('hidden');
        document.getElementById('user-selection-view').classList.remove('hidden');
        document.getElementById('login-error').textContent = '';
    });

    document.getElementById('password-form').addEventListener('submit', async e => {
        e.preventDefault();
        const user = state.db.users.find(u => u.name.toLowerCase() === selectedUserForLogin.toLowerCase());
        const passwordInput = document.getElementById('password');
        if (!user) {
            showToast('Usuário não encontrado.', 'error');
            return;
        }
        const email = `${user.name.toLowerCase().replace(/\s+/g, '')}@pdv-app.com`;
        try {
            await signInWithEmailAndPassword(auth, email, passwordInput.value);
            state.loggedInUser = user;
            if (user.role !== 'superadmin' && !state.selectedStore) {
                state.selectedStore = state.db.stores.find(s => s.id === user.storeId);
            }
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            passwordInput.value = '';
            document.getElementById('login-error').textContent = '';
            initializeAppUI();
        } catch (error) {
            console.error("Erro de login:", error.code);
            document.getElementById('login-error').textContent = 'Senha inválida.';
            document.getElementById('password-view').classList.add('animate-shake');
            setTimeout(() => document.getElementById('password-view').classList.remove('animate-shake'), 500);
        }
    });

    const logout = () => {
        signOut(auth);
        Object.values(state.listeners).forEach(listener => {
            if (typeof listener === 'function') listener();
        });
        state = { loggedInUser: null, currentView: '', currentOrder: [], db: { users: [], stores: [], products: [], clients: [], settings: {}, fixedCosts: [] }, listeners: {}, selectedStore: null };
        selectedUserForLogin = null;
        document.getElementById('app').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('store-switcher-container').classList.add('hidden');
        loadInitialData();
    };

    function setupStoreListeners(storeId) {
        if (state.listeners.products) state.listeners.products();
        if (state.listeners.clients) state.listeners.clients();
        if (state.listeners.sales) state.listeners.sales();
        if (state.listeners.fixedCosts) state.listeners.fixedCosts();

        const productsQuery = query(collection(db, "products"), where("storeId", "==", storeId));
        state.listeners.products = onSnapshot(productsQuery, (snapshot) => {
            state.db.products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        const clientsQuery = query(collection(db, "clients"), where("storeId", "==", storeId));
        state.listeners.clients = onSnapshot(clientsQuery, (snapshot) => {
            state.db.clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        const salesQuery = query(collection(db, "sales"), where("storeId", "==", storeId));
        state.listeners.sales = onSnapshot(salesQuery, (snapshot) => {
            state.db.sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        const fixedCostsQuery = query(collection(db, "fixedCosts"), where("storeId", "==", storeId));
        state.listeners.fixedCosts = onSnapshot(fixedCostsQuery, (snapshot) => {
            state.db.fixedCosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });
    }

    async function initializeAppUI() {
        const user = state.loggedInUser;
        const store = state.selectedStore;

        try {
            const settingsRef = doc(db, "settings", store.id);
            const settingsSnap = await getDoc(settingsRef);
            if (settingsSnap.exists()) {
                state.db.settings = { ...state.db.settings, ...settingsSnap.data() };
            }
        } catch (error) {
            console.error("Erro ao carregar configurações:", error);
            showToast("Erro ao carregar configurações da loja.", "error");
            logout();
            return;
        }

        if (!user || !user.role) {
            logout();
            return;
        }

        document.getElementById('store-name-sidebar').textContent = store.name;
        document.getElementById('username-sidebar').textContent = user.name;
        document.getElementById('user-icon').textContent = user.name.charAt(0).toUpperCase();

        if (state.listeners.users) state.listeners.users();
        const usersQuery = query(collection(db, "users"), where("storeId", "==", store.id));
        state.listeners.users = onSnapshot(usersQuery, (snapshot) => {
            state.db.users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        });
        
        setupStoreListeners(store.id);

        const vM = document.getElementById('vendedor-menu');
        const gM = document.getElementById('gerente-menu');
        vM.innerHTML = ''; gM.innerHTML = '';
        const createMenuItem = (v, i, t) => `<li><a href="#" data-view="${v}" class="flex items-center p-2 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white group transition-colors"><i data-lucide="${i}" class="w-5 h-5"></i><span class="ml-3">${t}</span></a></li>`;
        const createLogoutItem = () => `<li class="pt-2 mt-2 border-t border-slate-700"><button data-action="logout" class="w-full flex items-center p-2 text-red-400 rounded-lg hover:bg-red-500 hover:text-white group transition-colors"><i data-lucide="log-out" class="w-5 h-5"></i><span class="ml-3">Sair</span></button></li>`;

        if (user.role === 'vendedor') {
            vM.innerHTML = createMenuItem('caixa', 'shopping-basket', 'Caixa') + createMenuItem('pedidos', 'list-ordered', 'Pedidos') + createMenuItem('metas', 'target', 'Metas') + createMenuItem('ranking', 'trophy', 'Ranking') + createMenuItem('relatorios', 'layout-dashboard', 'Dashboard') + createLogoutItem();
            vM.classList.remove('hidden'); gM.classList.add('hidden');
            switchView('caixa');
        } else {
            gM.innerHTML = createMenuItem('relatorios', 'layout-dashboard', 'Dashboard') + createMenuItem('financeiro', 'dollar-sign', 'Financeiro') + createMenuItem('pedidos', 'list-ordered', 'Pedidos') + createMenuItem('clientes', 'users', 'Clientes') + createMenuItem('produtos', 'package', 'Produtos') + createMenuItem('ranking', 'trophy', 'Ranking') + createMenuItem('configuracoes', 'settings', 'Configurações') + createLogoutItem();
            gM.classList.remove('hidden'); vM.classList.add('hidden');
            switchView('relatorios');
        }
        
        document.getElementById('sidebar').addEventListener('click', e => {
            const link = e.target.closest('a[data-view]');
            const logoutBtn = e.target.closest('button[data-action="logout"]');
            if (link) { e.preventDefault(); switchView(link.dataset.view); }
            if (logoutBtn) { logout(); }
        });

        lucide.createIcons();
    }

    const switchView = (viewId) => {
        state.currentView = viewId;
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = ''; // Limpa a view anterior
        renderViewContent(viewId);

        document.querySelectorAll('#sidebar ul li a').forEach(l => l.classList.remove('bg-slate-700', 'text-white'));
        const link = document.querySelector(`#sidebar a[data-view="${viewId}"]`);
        if (link) {
            link.classList.add('bg-slate-700', 'text-white');
            document.getElementById('current-view-title').textContent = link.querySelector('span').textContent;
        }
    };

    const renderViewContent = (viewId) => {
        // As funções de renderização agora são chamadas diretamente
        switch (viewId) {
            case 'caixa': renderCaixa(); break;
            // ... outras views
            default:
                document.getElementById('main-content').innerHTML = `<p class="p-6">View "${viewId}" não encontrada.</p>`;
        }
    };
    
    // ... TODAS AS SUAS FUNÇÕES DE RENDERIZAÇÃO (renderCaixa, renderProdutos, etc.) VÃO AQUI ...
    // Vou colocar a de Produtos como exemplo:
    function renderProdutos() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <div class="space-y-6">
                <div class="custom-card p-6 rounded-lg">
                    <h3 id="product-form-title" class="text-lg font-semibold mb-4">Adicionar Novo Produto</h3>
                    <form id="add-product-form" class="space-y-4">
                        </form>
                </div>
                <div class="custom-card rounded-lg overflow-hidden">
                    <table class="w-full text-sm">
                        <thead>
                            <tr>
                                <th class="px-6 py-3">Produto</th>
                                <th class="px-6 py-3 text-center">Estoque</th>
                                <th class="px-6 py-3 text-right">Preço</th>
                                <th class="px-6 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="products-table-body"></tbody>
                    </table>
                </div>
            </div>`;
        
        // Lógica de eventos e renderização da tabela de produtos vai aqui
    }


    const init = () => {
        const theme = localStorage.getItem('theme') || 'dark';
        applyTheme(theme);
        const themeToggleHandler = () => {
            const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        };
        document.getElementById('theme-toggle').addEventListener('click', themeToggleHandler);
        document.getElementById('theme-toggle-app').addEventListener('click', themeToggleHandler);

        window.lucide.createIcons();
        loadInitialData();
    };

    init();
});