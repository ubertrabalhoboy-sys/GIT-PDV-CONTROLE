// Importa as variáveis 'db' e 'auth' já inicializadas do nosso novo arquivo
import { db, auth } from './firebase-init.js';

// Importa todas as outras funções do Firebase que seu sistema utiliza
import { collection, getDocs, onSnapshot, doc, addDoc, deleteDoc, setDoc, query, where, writeBatch, Timestamp, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
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
            fixedCosts: []
        },
        listeners: { users: null, sales: null, stores: null, products: null, clients: null, orders: null, metas: null, ranking: null, relatorios: null, fixedCosts: null },
        selectedStore: null
    };
    let selectedUserForLogin = null;
    let vendasChartInstance = null;
    let pagamentoChartInstance = null;
    let financeiroChartInstance = null;
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

    function exportToCSV(data, filename) {
        if (data.length === 0) {
            showToast('Nenhuma venda encontrada para exportar.', 'error');
            return;
        }
        const headers = [ "Data da Compra", "ID da Venda", "Nome do Cliente", "Telefone do Cliente", "Vendedor", "Itens Vendidos", "Forma de Pagamento", "Total da Venda", "Comissão da Venda" ];
        const formatItemsForCSV = (items) => {
            if (!Array.isArray(items)) return '';
            return items.map(item => `${item.name} (Valor: ${formatCurrency(item.value)}, Troca: ${item.exchange})`).join(' | ');
        };
        const formatPaymentsForCSV = (payments) => {
            if (Array.isArray(payments) && payments.length > 0) {
                return payments.map(p => {
                    let paymentString = `${p.method}: ${formatCurrency(p.amount)}`;
                    if (p.installments) {
                        paymentString += ` (em ${p.installments})`;
                    }
                    return paymentString;
                }).join(' | ');
            }
            return payments || '';
        };
        const rows = data.map(sale => [
            new Date(sale.date.seconds * 1000).toLocaleString('pt-BR'),
            sale.id,
            sale.clientName,
            sale.clientPhone || '',
            sale.vendedor,
            formatItemsForCSV(sale.items),
            formatPaymentsForCSV(sale.paymentMethods || sale.paymentMethod),
            (sale.total || 0).toFixed(2).replace('.', ','),
            (sale.commission || 0).toFixed(2).replace('.', ',')
        ]);
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

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
        state.listeners = { users: null, sales: null, stores: null, products: null, clients: null, orders: null, metas: null, ranking: null, relatorios: null, fixedCosts: null };
        Object.assign(state, {
            loggedInUser: null,
            selectedStore: null,
            currentOrder: [],
            db: { users: [], stores: [], products: [], clients: [], settings: {} }
        });
        selectedUserForLogin = null;
        document.getElementById('app').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('store-switcher-container').classList.add('hidden');
        loadInitialData();
    };

    function setupStoreListeners(storeId) {
        if (state.listeners.products) state.listeners.products();
        if (state.listeners.clients) state.listeners.clients();
        if (state.listeners.fixedCosts) state.listeners.fixedCosts();

        const productsQuery = query(collection(db, "products"), where("storeId", "==", storeId));
        state.listeners.products = onSnapshot(productsQuery, (snapshot) => {
            state.db.products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (state.currentView === 'produtos' && document.getElementById('produtos-view').classList.contains('active')) {
                renderProdutos();
            }
        }, (error) => {
            console.error("Erro ao carregar produtos:", error);
            showToast('Erro ao carregar produtos. Verifique as permissões.', 'error');
        });

        const clientsQuery = query(collection(db, "clients"), where("storeId", "==", storeId));
        state.listeners.clients = onSnapshot(clientsQuery, (snapshot) => {
            state.db.clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (state.currentView === 'clientes' && document.getElementById('clientes-view').classList.contains('active')) {
                renderClientes();
            }
        }, (error) => {
            console.error("Erro ao carregar clientes:", error);
            showToast('Erro ao carregar clientes.', 'error');
        });

        const fixedCostsQuery = query(collection(db, "fixedCosts"), where("storeId", "==", storeId));
        state.listeners.fixedCosts = onSnapshot(fixedCostsQuery, (snapshot) => {
            state.db.fixedCosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (state.currentView === 'financeiro' && document.getElementById('financeiro-view').classList.contains('active')) {
                renderFinanceiro();
            }
        }, (error) => {
            console.error("Erro ao carregar custos fixos:", error);
        });
    }

    const initializeAppUI = async () => {
        const user = state.loggedInUser;
        const store = state.selectedStore;

        const settingsRef = doc(db, "settings", state.selectedStore.id);
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
            state.db.settings = { ...state.db.settings, ...settingsSnap.data() };
        } else {
            const defaultSettings = {
                storeName: state.selectedStore.name,
                goals: { daily: 150, weekly: 1000, monthly: 4000 },
                commissionSystem: { enabled: true, percentage: 5 },
                bonusWheel: { enabled: false, prizes: [], minValue: 0 },
                ownerPhone: ''
            };
            await setDoc(settingsRef, defaultSettings);
            state.db.settings = { ...state.db.settings, ...defaultSettings };
        }

        if (!user || !user.role) {
            console.error("ERRO CRÍTICO: O objeto do usuário logado não tem uma 'role' (função) definida. Fazendo logout forçado.");
            showToast("Erro de autenticação, por favor faça login novamente.", "error");
            logout();
            return;
        }

        document.getElementById('store-name-sidebar').textContent = store.name;
        document.getElementById('username-sidebar').textContent = user.name;
        document.getElementById('user-icon').textContent = user.name.charAt(0).toUpperCase();

        if (state.listeners.users) state.listeners.users();
        const usersQuery = query(collection(db, "users"), where("storeId", "==", store.id));
        state.listeners.users = onSnapshot(usersQuery, (snapshot) => {
            state.db.users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (state.currentView && (state.currentView === 'pedidos' || state.currentView === 'configuracoes' || state.currentView === 'relatorios')) {
                const activeView = document.getElementById(`${state.currentView}-view`);
                if (activeView && activeView.classList.contains('active')) {
                    renderViewContent(state.currentView);
                }
            }
        });
        
        setupStoreListeners(store.id);

        const switcherContainer = document.getElementById('store-switcher-container');
        if (user.role === 'superadmin') {
            if (state.listeners.stores) state.listeners.stores();
            state.listeners.stores = onSnapshot(query(collection(db, "stores")), (snapshot) => {
                state.db.stores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const select = document.getElementById('store-switcher-select');
                if (select) {
                    const currentStoreId = state.selectedStore ? state.selectedStore.id : (state.db.stores[0]?.id || '');
                    select.innerHTML = '';
                    state.db.stores.forEach(s => {
                        select.innerHTML += `<option value="${s.id}" ${s.id === currentStoreId ? 'selected' : ''}>${s.name}</option>`;
                    });
                    if (!state.db.stores.some(s => s.id === currentStoreId)) {
                        if (state.db.stores.length > 0) {
                            state.selectedStore = state.db.stores[0];
                            initializeAppUI();
                            switchView(state.currentView || 'pedidos');
                        } else {
                            logout();
                        }
                    }
                }
            });

            switcherContainer.classList.remove('hidden');
            const select = document.getElementById('store-switcher-select');
            select.onchange = async (e) => {
                const newStoreId = e.target.value;
                state.selectedStore = state.db.stores.find(s => s.id === newStoreId);
                const newSettingsRef = doc(db, "settings", state.selectedStore.id);
                const newSettingsSnap = await getDoc(newSettingsRef);
                if (newSettingsSnap.exists()) {
                    state.db.settings = { ...state.db.settings, ...newSettingsSnap.data() };
                }
                document.getElementById('store-name-sidebar').textContent = state.selectedStore.name;
                setupStoreListeners(newStoreId);
                switchView(state.currentView);
            };
        } else {
            switcherContainer.classList.add('hidden');
        }

        const createMenuItem = (v, i, t) => `<li><a href="#" data-view="${v}" class="flex items-center p-2 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white group transition-colors"><i data-lucide="${i}" class="w-5 h-5"></i><span class="ml-3">${t}</span></a></li>`;
        const createLogoutItem = () => `<li class="pt-2 mt-2 border-t border-slate-700"><button data-action="logout" class="w-full flex items-center p-2 text-red-400 rounded-lg hover:bg-red-500 hover:text-white group transition-colors"><i data-lucide="log-out" class="w-5 h-5"></i><span class="ml-3">Sair</span></button></li>`;

        const vM = document.getElementById('vendedor-menu'), gM = document.getElementById('gerente-menu');
        vM.innerHTML = ''; gM.innerHTML = '';

        if (user.role === 'vendedor') {
            vM.innerHTML = createMenuItem('caixa', 'shopping-basket', 'Caixa') + createMenuItem('pedidos', 'list-ordered', 'Pedidos') + createMenuItem('metas', 'target', 'Metas') + createMenuItem('ranking', 'trophy', 'Ranking') + createMenuItem('relatorios', 'layout-dashboard', 'Dashboard') + createLogoutItem();
            vM.classList.remove('hidden'); gM.classList.add('hidden');
            switchView('caixa');
        } else {
            const managerMenuHTML = createMenuItem('relatorios', 'layout-dashboard', 'Dashboard') +
                                      createMenuItem('financeiro', 'dollar-sign', 'Financeiro') +
                                      createMenuItem('pedidos', 'list-ordered', 'Pedidos') + 
                                      createMenuItem('clientes', 'users', 'Clientes') + 
                                      createMenuItem('produtos', 'package', 'Produtos') + 
                                      createMenuItem('ranking', 'trophy', 'Ranking') + 
                                      createMenuItem('configuracoes', 'settings', 'Configurações') + 
                                      createLogoutItem();
            
            gM.innerHTML = managerMenuHTML;
            gM.classList.remove('hidden'); vM.classList.add('hidden');
            switchView('relatorios');
        }

        document.getElementById('sidebar').addEventListener('click', e => {
            const link = e.target.closest('a[data-view]'), logoutBtn = e.target.closest('button[data-action="logout"]');
            if (link) { e.preventDefault(); switchView(link.dataset.view); }
            if (logoutBtn) { logout(); }
        });

        document.getElementById('app').addEventListener('click', async (e) => {
            const shareBtn = e.target.closest('.share-daily-report-btn');
            if(shareBtn) {
                const ownerPhone = state.db.settings.ownerPhone?.replace(/\D/g, '');
                if (!ownerPhone) {
                    return showToast('Telefone do dono não configurado. Adicione em Configurações.', 'error');
                }
                
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                
                const salesTodayQuery = query(collection(db, "sales"), where("storeId", "==", state.selectedStore.id), where("date", ">=", todayStart));
                const salesSnapshot = await getDocs(salesTodayQuery);
                const salesToday = salesSnapshot.docs.map(doc => doc.data());
                const totalToday = salesToday.reduce((sum, s) => sum + s.total, 0);

                const summaryText = `*Resumo do Dia - ${now.toLocaleDateString('pt-BR')}*\n\n` +
                                    `*Loja:* ${state.selectedStore.name}\n` +
                                    `*Total Vendido:* ${formatCurrency(totalToday)}\n` +
                                    `*Vendas Realizadas:* ${salesToday.length}\n` +
                                    `*Ticket Médio:* ${formatCurrency(salesToday.length > 0 ? totalToday / salesToday.length : 0)}`;

                const encodedText = encodeURIComponent(summaryText);
                window.open(`https://wa.me/55${ownerPhone}?text=${encodedText}`, '_blank');
            }
        });

        window.lucide.createIcons();
    };

    const switchView = (viewId) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active', 'fade-in'));
        const activeView = document.getElementById(`${viewId}-view`);
        if (activeView) {
            activeView.classList.add('active', 'fade-in'); state.currentView = viewId;
            const link = document.querySelector(`#sidebar a[data-view="${viewId}"]`);
            if (link) {
                document.getElementById('current-view-title').textContent = link.querySelector('span').textContent;
                document.querySelectorAll('#sidebar ul li a').forEach(l => l.classList.remove('bg-slate-700', 'text-white'));
                link.classList.add('bg-slate-700', 'text-white');
            }
            renderViewContent(viewId);
        }
        showMobileMenu(false);
    };

    const renderViewContent = (viewId) => {
        const viewContainer = document.getElementById(`${viewId}-view`);
        if (!viewContainer) {
             console.error(`Container da view "${viewId}" não encontrado.`);
             return;
        }
        
        // As funções de renderização agora injetam seu próprio HTML
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
                viewContainer.innerHTML = `<p class="p-6">View "${viewId}" não encontrada.</p>`;
        }
    };

    const sidebar = document.getElementById('sidebar'), overlay = document.getElementById('sidebar-overlay');
    const showMobileMenu = s => { if (s) { sidebar.classList.remove('-translate-x-full'); overlay.classList.remove('hidden') } else { sidebar.classList.add('-translate-x-full'); overlay.classList.add('hidden') } };
    document.getElementById('mobile-menu-button').addEventListener('click', () => showMobileMenu(true));
    overlay.addEventListener('click', () => showMobileMenu(false));

    // O resto de todas as suas funções de renderização (renderCaixa, renderProdutos, etc.) continuam aqui
    // ...
    // ...
    
    const init = () => {
        const theme = localStorage.getItem('theme') || 'dark';
        applyTheme(theme);
        const themeToggleHandler = () => {
            const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
            if (['relatorios', 'metas', 'ranking', 'financeiro'].includes(state.currentView) && document.getElementById(`${state.currentView}-view`).classList.contains('active')) {
                renderViewContent(state.currentView);
            }
        };
        document.getElementById('theme-toggle').addEventListener('click', themeToggleHandler);
        document.getElementById('theme-toggle-app').addEventListener('click', themeToggleHandler);

        window.lucide.createIcons();
        loadInitialData();
    };

    init();
});