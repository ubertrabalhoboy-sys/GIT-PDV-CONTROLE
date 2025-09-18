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
            case 'pedidos': renderPedidos(); break;
            case 'clientes': renderClientes(); break;
            case 'produtos': renderProdutos(); break;
            case 'financeiro': renderFinanceiro(); break;
            case 'metas': renderMetas(); break;
            case 'ranking': renderRanking(); break;
            case 'relatorios': renderDashboard(); break;
            case 'configuracoes': renderConfiguracoes(); break;
            default:
                document.getElementById('main-content').innerHTML = `<p class="p-6">View "${viewId}" não encontrada.</p>`;
        }
    };
    
    function renderCaixa() {
        // This function injects its own HTML, so we just call it.
        // For brevity, assuming this function exists and is correct as in the original file.
        const view = document.getElementById('main-content');
        view.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2">
                    <div class="custom-card p-6 rounded-lg">
                        <h3 class="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Adicionar Item</h3>
                        <form id="add-item-form" class="space-y-4">
                             <div class="relative">
                                <label for="product-search" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Buscar Produto no Estoque</label>
                                <input type="text" id="product-search" class="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 shadow-sm bg-slate-200/50 dark:bg-slate-800/50" autocomplete="off" placeholder="Digite para buscar...">
                                <div id="product-search-results" class="absolute z-10 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto hidden"></div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div class="md:col-span-2">
                                    <label for="item-name" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Nome do Item/Serviço</label>
                                    <input type="text" id="item-name" class="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 shadow-sm bg-slate-200/50 dark:bg-slate-800/50" required>
                                </div>
                                <div>
                                    <label for="item-value" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Valor (R$)</label>
                                    <input type="number" id="item-value" class="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 shadow-sm bg-slate-200/50 dark:bg-slate-800/50" step="0.01" required>
                                </div>
                            </div>
                            <div>
                                <label for="item-exchange" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Troca (Opcional)</label>
                                <input type="text" id="item-exchange" class="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 shadow-sm bg-slate-200/50 dark:bg-slate-800/50" placeholder="Ex: Capinha, Película">
                            </div>
                            <div class="text-right">
                                <button type="submit" class="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-blue-700">
                                    <i data-lucide="plus-circle" class="w-4 h-4 mr-2"></i> Adicionar ao Pedido
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                <div>
                    <div class="custom-card p-6 rounded-lg sticky top-20">
                        <h3 class="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Pedido Atual</h3>
                        <div id="current-order-items" class="space-y-3 mb-4 max-h-96 overflow-y-auto">
                            <p id="no-items-message" class="text-slate-500 dark:text-slate-400 text-center py-4">Nenhum item adicionado.</p>
                        </div>
                        <div class="border-t border-slate-300 dark:border-slate-700 pt-4">
                            <div class="flex justify-between items-center text-xl font-bold">
                                <span class="text-slate-800 dark:text-slate-200">Total:</span>
                                <span id="current-order-total" class="text-brand-primary">R$ 0,00</span>
                            </div>
                            <button id="finalize-order-button" class="mt-4 w-full bg-brand-secondary text-white py-3 px-4 rounded-md hover:bg-green-700 transition-colors text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed" disabled>Finalizar Pedido</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    
        const itemsContainer = view.querySelector('#current-order-items');
        const totalEl = view.querySelector('#current-order-total');
        const finalizeBtn = view.querySelector('#finalize-order-button');
        const addForm = view.querySelector('#add-item-form');
        const modalContainer = document.getElementById('modal-container');
        
        const productSearchInput = view.querySelector('#product-search');
        const searchResultsContainer = view.querySelector('#product-search-results');
        let selectedProduct = null;
    
        const updateUI = () => {
            itemsContainer.innerHTML = '';
            if (state.currentOrder.length === 0) {
                itemsContainer.innerHTML = '<p id="no-items-message" class="text-slate-500 dark:text-slate-400 text-center py-4">Nenhum item adicionado.</p>';
                finalizeBtn.disabled = true;
            } else {
                state.currentOrder.forEach((item, i) => {
                    const el = document.createElement('div');
                    el.className = 'flex justify-between items-center bg-slate-200/50 dark:bg-slate-800/50 p-3 rounded-md';
                    
                    const stockIcon = item.productId ? `<i data-lucide="package" class="w-4 h-4 text-slate-500 mr-2" title="Item do Estoque"></i>` : '';
    
                    el.innerHTML = `
                        <div class="flex items-center">
                            ${stockIcon}
                            <div>
                                <p class="font-semibold text-slate-800 dark:text-slate-200">${item.name}</p>
                                <p class="text-xs text-slate-500 dark:text-slate-400">Troca: ${item.exchange || 'N/A'}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-4">
                            <span class="font-semibold text-slate-800 dark:text-slate-200">${formatCurrency(item.value)}</span>
                            <button data-index="${i}" class="remove-item-btn text-red-500 hover:text-red-700 transition-colors">
                                <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                            </button>
                        </div>`;
                    itemsContainer.appendChild(el);
                });
                finalizeBtn.disabled = false;
            }
            totalEl.textContent = formatCurrency(state.currentOrder.reduce((sum, i) => sum + i.value, 0));
            window.lucide.createIcons();
        };
    
        addForm.addEventListener('submit', e => {
            e.preventDefault();
            
            const newItem = {
                name: view.querySelector('#item-name').value,
                value: parseFloat(view.querySelector('#item-value').value),
                exchange: view.querySelector('#item-exchange').value,
                cost: 0 
            };
            
            if (selectedProduct) {
                newItem.productId = selectedProduct.id;
                newItem.cost = selectedProduct.cost || 0;
            }
    
            state.currentOrder.push(newItem);
            updateUI();
            addForm.reset();
            productSearchInput.value = '';
            selectedProduct = null;
            view.querySelector('#item-name').focus();
        });
    
        itemsContainer.addEventListener('click', e => {
            const b = e.target.closest('.remove-item-btn');
            if (b) {
                state.currentOrder.splice(b.dataset.index, 1);
                updateUI();
            }
        });
        
        productSearchInput.addEventListener('input', () => {
            const searchTerm = productSearchInput.value.toLowerCase();
            if (searchTerm.length < 2) {
                searchResultsContainer.innerHTML = '';
                searchResultsContainer.classList.add('hidden');
                return;
            }
    
            const results = state.db.products.filter(p => 
                p.name.toLowerCase().includes(searchTerm) && p.quantity > 0
            );
    
            if (results.length > 0) {
                searchResultsContainer.innerHTML = results.map(p => `
                    <div class="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer" data-product-id="${p.id}">
                        <p class="font-semibold text-slate-800 dark:text-slate-200">${p.name}</p>
                        <p class="text-sm text-slate-500">Estoque: ${p.quantity} | ${formatCurrency(p.price)}</p>
                    </div>
                `).join('');
                searchResultsContainer.classList.remove('hidden');
            } else {
                searchResultsContainer.classList.add('hidden');
            }
        });
    
        searchResultsContainer.addEventListener('click', (e) => {
            const resultDiv = e.target.closest('[data-product-id]');
            if (resultDiv) {
                const productId = resultDiv.dataset.productId;
                selectedProduct = state.db.products.find(p => p.id === productId);
    
                if (selectedProduct) {
                    view.querySelector('#item-name').value = selectedProduct.name;
                    view.querySelector('#item-value').value = selectedProduct.price;
                }
    
                productSearchInput.value = '';
                searchResultsContainer.classList.add('hidden');
            }
        });
    
        finalizeBtn.addEventListener('click', () => {
            const orderTotal = state.currentOrder.reduce((sum, i) => sum + i.value, 0);
    
            modalContainer.innerHTML = `
                <div id="finalize-order-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div class="custom-card rounded-lg shadow-xl w-full max-w-lg p-6 m-4 fade-in">
                        <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Finalizar Pedido</h2>
                        <p class="mb-4 text-lg">Total do Pedido: <span id="modal-total-value" class="font-bold text-brand-primary">${formatCurrency(orderTotal)}</span></p>
                        
                        <form id="finalize-order-form" class="space-y-3">
                            <div class="relative">
                                <label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Buscar Cliente</label>
                                <input type="text" id="sale-client-search" autocomplete="off" class="block w-full rounded-md border-slate-300 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-800/50" placeholder="Digite nome ou telefone...">
                                 <div id="sale-client-search-results" class="absolute z-20 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto hidden"></div>
                            </div>
                            <div><label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Nome do Cliente (para a venda)</label><input type="text" id="client-name" required class="block w-full rounded-md border-slate-300 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-800/50"></div>
                            <div><label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Telefone (WhatsApp)</label><input type="tel" id="client-phone" class="block w-full rounded-md border-slate-300 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-800/50" placeholder="Ex: 11987654321"></div>

                            <div class="border-t border-slate-300 dark:border-slate-700 pt-3">
                                <label class="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-200">Formas de Pagamento</label>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div><label for="payment-pix" class="text-xs text-slate-500">Pix</label><input type="number" id="payment-pix" data-method="Pix" class="payment-input block w-full rounded-md border-slate-300 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-800/50" step="0.01" placeholder="0,00"></div>
                                    <div><label for="payment-dinheiro" class="text-xs text-slate-500">Dinheiro</label><input type="number" id="payment-dinheiro" data-method="Dinheiro" class="payment-input block w-full rounded-md border-slate-300 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-800/50" step="0.01" placeholder="0,00"></div>
                                </div>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                    <div>
                                        <label for="payment-cartao" class="text-xs text-slate-500">Cartão</label>
                                        <input type="number" id="payment-cartao" data-method="Cartão" class="payment-input block w-full rounded-md border-slate-300 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-800/50" step="0.01" placeholder="0,00">
                                    </div>
                                    <div id="installments-container" class="hidden">
                                        <label for="payment-installments" class="text-xs text-slate-500">Parcelas</label>
                                        <select id="payment-installments" class="block w-full rounded-md border-slate-300 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-800/50">
                                            ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}x">${i + 1}x</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="border-t border-slate-300 dark:border-slate-700 pt-3 text-right text-sm">
                                <p>Total Pago: <span id="modal-paid-value" class="font-semibold text-slate-800 dark:text-slate-200">R$ 0,00</span></p>
                                <p>Restante: <span id="modal-remaining-value" class="font-semibold text-red-500">R$ 0,00</span></p>
                            </div>

                            <div class="pt-4 flex justify-end gap-4">
                                <button type="button" id="cancel-finalize-button" class="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 py-2 px-4 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500">Cancelar</button>
                                <button type="submit" id="confirm-sale-button" class="bg-brand-primary text-white py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" disabled>Confirmar Venda</button>
                            </div>
                        </form>
                    </div>
                </div>
                `;
            
            let selectedClient = null;
            const clientSearchInput = modalContainer.querySelector('#sale-client-search');
            const clientSearchResults = modalContainer.querySelector('#sale-client-search-results');
            const clientNameInput = modalContainer.querySelector('#client-name');
            const clientPhoneInput = modalContainer.querySelector('#client-phone');
            
            clientSearchInput.addEventListener('input', () => {
                const term = clientSearchInput.value.toLowerCase();
                if (term.length < 2) {
                    clientSearchResults.classList.add('hidden');
                    return;
                }
                const results = state.db.clients.filter(c => c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term)));
                if(results.length > 0) {
                    clientSearchResults.innerHTML = results.map(c => `
                        <div class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer" data-client-id="${c.id}">
                            <p class="text-sm font-medium">${c.name}</p>
                            <p class="text-xs text-slate-500">${c.phone || 'Sem telefone'}</p>
                        </div>
                    `).join('');
                    clientSearchResults.classList.remove('hidden');
                } else {
                    clientSearchResults.classList.add('hidden');
                }
            });
    
            clientSearchResults.addEventListener('click', e => {
                const clientDiv = e.target.closest('[data-client-id]');
                if(clientDiv) {
                    selectedClient = state.db.clients.find(c => c.id === clientDiv.dataset.clientId);
                    if(selectedClient){
                        clientNameInput.value = selectedClient.name;
                        clientPhoneInput.value = selectedClient.phone || '';
                    }
                    clientSearchResults.classList.add('hidden');
                    clientSearchInput.value = selectedClient.name;
                }
            });
    
            const paidValueEl = modalContainer.querySelector('#modal-paid-value');
            const remainingValueEl = modalContainer.querySelector('#modal-remaining-value');
            const confirmBtn = modalContainer.querySelector('#confirm-sale-button');
            const paymentInputs = modalContainer.querySelectorAll('.payment-input');
            const cartaoInput = modalContainer.querySelector('#payment-cartao');
            const installmentsContainer = modalContainer.querySelector('#installments-container');
    
            const updatePaymentSummary = () => {
                let paidAmount = 0;
                paymentInputs.forEach(input => {
                    paidAmount += parseFloat(input.value) || 0;
                });
    
                const remainingAmount = orderTotal - paidAmount;
    
                paidValueEl.textContent = formatCurrency(paidAmount);
                remainingValueEl.textContent = formatCurrency(remainingAmount);
    
                installmentsContainer.classList.toggle('hidden', !(parseFloat(cartaoInput.value) > 0));
    
                if (remainingAmount <= 0.001) {
                    confirmBtn.disabled = false;
                    remainingValueEl.classList.remove('text-red-500');
                    remainingValueEl.classList.add('text-green-500');
                    if (remainingAmount < -0.001) {
                        remainingValueEl.innerHTML = `Troco: <span class="font-bold">${formatCurrency(Math.abs(remainingAmount))}</span>`;
                    } else {
                        remainingValueEl.textContent = 'Pago';
                    }
                } else {
                    confirmBtn.disabled = true;
                    remainingValueEl.classList.add('text-red-500');
                    remainingValueEl.classList.remove('text-green-500');
                }
            };
    
            updatePaymentSummary();
            paymentInputs.forEach(input => input.addEventListener('input', updatePaymentSummary));
    
            modalContainer.querySelector('#cancel-finalize-button').addEventListener('click', () => modalContainer.innerHTML = '');
    
            modalContainer.querySelector('#finalize-order-form').addEventListener('submit', async e => {
                e.preventDefault();
    
                const paymentMethods = [];
                paymentInputs.forEach(input => {
                    const amount = parseFloat(input.value);
                    if (amount > 0) {
                        const method = {
                            method: input.dataset.method,
                            amount: amount
                        };
                        if (input.id === 'payment-cartao') {
                            method.installments = modalContainer.querySelector('#payment-installments').value;
                        }
                        paymentMethods.push(method);
                    }
                });
    
                if (paymentMethods.length === 0) {
                    showToast('Adicione ao menos uma forma de pagamento.', 'error');
                    return;
                }
    
                const total = orderTotal;
                let commission = 0;
                const commissionConfig = state.db.settings.commissionSystem;
                if (commissionConfig && commissionConfig.enabled && commissionConfig.percentage > 0) {
                    commission = (total * commissionConfig.percentage) / 100;
                }
    
                const saleData = {
                    clientName: clientNameInput.value,
                    clientPhone: clientPhoneInput.value,
                    clientId: selectedClient ? selectedClient.id : null,
                    paymentMethods: paymentMethods,
                    paymentMethod: paymentMethods.map(p => p.method).join(' + '),
                    paymentMethodTypes: paymentMethods.map(p => p.method),
                    items: state.currentOrder,
                    total: total,
                    commission: commission,
                    date: Timestamp.now(),
                    vendedor: state.loggedInUser.name,
                    status: 'Finalizado',
                    storeId: state.selectedStore.id,
                    prizeWon: null
                };
    
                try {
                    const batch = writeBatch(db);
                    const itemsToDecrement = state.currentOrder.filter(item => item.productId);
                    
                    itemsToDecrement.forEach(item => {
                        const productRef = doc(db, "products", item.productId);
                        batch.update(productRef, { quantity: increment(-1) });
                    });
                    
                    const newSaleRef = doc(collection(db, "sales"));
                    batch.set(newSaleRef, saleData);
                    
                    await batch.commit();
    
                    saleData.id = newSaleRef.id;
                    
                    showToast('Venda registrada e estoque atualizado!', 'success');
                    modalContainer.innerHTML = '';
    
                    const wheelConfig = state.db.settings.bonusWheel;
                    if (wheelConfig && wheelConfig.enabled && wheelConfig.prizes && wheelConfig.prizes.length > 0 && total >= (wheelConfig.minValue || 0)) {
                        //showBonusWheelModal(saleData);
                    } else if (saleData.clientPhone) {
                       // showWhatsAppModal(saleData);
                    }
    
                    state.currentOrder = [];
                    updateUI();
                } catch (error) {
                    showToast('Erro ao registrar a venda. Estoque pode não ter sido atualizado.', 'error');
                    console.error("Erro no batch de venda:", error);
                }
            });
        });
        updateUI();
    }
    
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
                        <thead class="bg-slate-200/50 dark:bg-slate-800/50">
                            <tr>
                                <th class="px-6 py-3 text-left">Produto</th>
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