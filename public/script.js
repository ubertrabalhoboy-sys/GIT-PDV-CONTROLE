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

        const headers = [
            "Data da Compra", "ID da Venda", "Nome do Cliente", "Telefone do Cliente", "Vendedor",
            "Itens Vendidos", "Forma de Pagamento", "Total da Venda", "Comissão da Venda"
        ];

        const formatItemsForCSV = (items) => {
            if (!Array.isArray(items)) return '';
            return items.map(item =>
                `${item.name} (Valor: ${formatCurrency(item.value)}, Troca: ${item.exchange})`
            ).join(' | ');
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

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"
            + headers.join(",") + "\n"
            + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

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
            if (typeof listener === 'function') {
                listener();
            }
        });
        state.listeners = { users: null, sales: null, stores: null, products: null, clients: null, orders: null, metas: null, ranking: null, relatorios: null, fixedCosts: null };
        Object.assign(state, {
            loggedInUser: null,
            selectedStore: null,
            currentOrder: [],
            db: { users: [], stores: [], sales: [], products: [], clients: [], settings: {} }
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
        if (state.listeners.sales) state.listeners.sales();
        if (state.listeners.fixedCosts) state.listeners.fixedCosts();

        const productsQuery = query(collection(db, "products"), where("storeId", "==", storeId));
        state.listeners.products = onSnapshot(productsQuery, (snapshot) => {
            state.db.products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (state.currentView === 'produtos') {
                renderProdutos();
            }
        }, (error) => {
            console.error("Erro ao carregar produtos:", error);
            showToast('Erro ao carregar produtos. Verifique as permissões.', 'error');
        });

        const clientsQuery = query(collection(db, "clients"), where("storeId", "==", storeId));
        state.listeners.clients = onSnapshot(clientsQuery, (snapshot) => {
            state.db.clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (state.currentView === 'clientes') {
                renderClientes();
            }
        }, (error) => {
            console.error("Erro ao carregar clientes:", error);
            showToast('Erro ao carregar clientes.', 'error');
        });

        const salesQuery = query(collection(db, "sales"), where("storeId", "==", storeId));
        state.listeners.sales = onSnapshot(salesQuery, (snapshot) => {
            state.db.sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }, (error) => {
            console.error("Erro ao carregar dados de vendas:", error);
        });

        const fixedCostsQuery = query(collection(db, "fixedCosts"), where("storeId", "==", storeId));
        state.listeners.fixedCosts = onSnapshot(fixedCostsQuery, (snapshot) => {
            state.db.fixedCosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (state.currentView === 'financeiro') {
                renderFinanceiro();
            }
        }, (error) => {
            console.error("Erro ao carregar custos fixos:", error);
        });
    }

    const initializeAppUI = () => {
        const user = state.loggedInUser;
        const store = state.selectedStore;

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
        state.listeners.users = onSnapshot(query(collection(db, "users")), (snapshot) => {
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
                const settingsRef = doc(db, "settings", state.selectedStore.id);
                const settingsSnap = await getDoc(settingsRef);
                if (settingsSnap.exists()) {
                    state.db.settings = { ...state.db.settings, ...settingsSnap.data() };
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

        document.getElementById('app').addEventListener('click', e => {
            const shareBtn = e.target.closest('.share-daily-report-btn');
            if(shareBtn) {
                const ownerPhone = state.db.settings.ownerPhone?.replace(/\D/g, '');
                if (!ownerPhone) {
                    return showToast('Telefone do dono não configurado. Adicione em Configurações.', 'error');
                }
                
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const salesToday = state.db.sales.filter(s => s.date.toDate() >= todayStart);
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
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `<div id="${viewId}-view" class="view active fade-in"></div>`; // Cria um container para a view
        state.currentView = viewId;
        
        const link = document.querySelector(`#sidebar a[data-view="${viewId}"]`);
        if (link) {
            document.getElementById('current-view-title').textContent = link.querySelector('span').textContent;
            document.querySelectorAll('#sidebar ul li a').forEach(l => l.classList.remove('bg-slate-700', 'text-white'));
            link.classList.add('bg-slate-700', 'text-white');
        }
        renderViewContent(viewId);
        showMobileMenu(false);
    };

    const renderViewContent = (viewId) => {
        const viewContainer = document.getElementById(`${viewId}-view`);
        // As views agora são renderizadas por suas próprias funções, não por templates HTML
        if (!viewContainer) {
             console.error(`Container da view "${viewId}" não encontrado.`);
             return;
        }

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
                viewContainer.innerHTML = document.getElementById(`${viewId}-template`)?.innerHTML || `<p class="p-6">View não encontrada.</p>`;
        }
    };

    const sidebar = document.getElementById('sidebar'), overlay = document.getElementById('sidebar-overlay');
    const showMobileMenu = s => { if (s) { sidebar.classList.remove('-translate-x-full'); overlay.classList.remove('hidden') } else { sidebar.classList.add('-translate-x-full'); overlay.classList.add('hidden') } };
    document.getElementById('mobile-menu-button').addEventListener('click', () => showMobileMenu(true));
    overlay.addEventListener('click', () => showMobileMenu(false));

    function showPrizeWonModal(prize, saleData) {
        const modal = document.getElementById('prize-won-modal');
        modal.classList.remove('hidden');
        
        const isWinner = !prize.name.toLowerCase().includes('tente novamente') && !prize.name.toLowerCase().includes('não foi dessa vez');
        
        let modalContent;
        if (isWinner) {
            modalContent = `
                <div class="confetti-container"></div>
                <i data-lucide="party-popper" class="w-16 h-16 mx-auto mb-4 text-amber-400"></i>
                <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Parabéns!</h2>
                <p class="text-slate-600 dark:text-slate-400 mt-2">Você ganhou:</p>
                <p class="text-2xl sm:text-3xl font-bold text-brand-secondary my-4">${prize.name}</p>
            `;
        } else {
            modalContent = `
                <i data-lucide="meh" class="w-16 h-16 mx-auto mb-4 text-slate-500"></i>
                <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Resultado da Roleta</h2>
                <p class="text-slate-600 dark:text-slate-400 mt-2">O resultado foi:</p>
                <p class="text-2xl sm:text-3xl font-bold text-slate-600 dark:text-slate-300 my-4">${prize.name}</p>
            `;
        }

        modal.innerHTML = `
            <div class="custom-card rounded-lg shadow-xl w-full max-w-sm p-8 m-4 fade-in text-center relative overflow-hidden">
                ${modalContent}
                <button id="close-prize-modal" class="w-full bg-brand-primary text-white py-2.5 px-4 rounded-md hover:bg-blue-700 transition-colors">Continuar</button>
            </div>
        `;
        
        window.lucide.createIcons();
        
        if (isWinner) {
            const confettiContainer = modal.querySelector('.confetti-container');
            for (let i = 0; i < 50; i++) {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                const colors = ['#3b82f6', '#22c55e', '#ec4899', '#f59e0b', '#8b5cf6'];
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.left = `${Math.random() * 100}%`;
                confetti.style.animationDelay = `${Math.random() * 3}s`;
                confetti.style.width = `${Math.random() * 8 + 5}px`;
                confetti.style.height = confetti.style.width;
                confettiContainer.appendChild(confetti);
            }
        }

        modal.querySelector('#close-prize-modal').addEventListener('click', () => {
            modal.classList.add('hidden');
            if (saleData.clientPhone) {
                showWhatsAppModal(saleData);
            }
        }, { once: true });
    }

    async function showBonusWheelModal(saleData) {
        const modal = document.getElementById('bonus-wheel-modal');
        const prizes = state.db.settings.bonusWheel.prizes;

        if (!prizes || prizes.length === 0) {
            if (saleData.clientPhone) showWhatsAppModal(saleData);
            return;
        }

        const segmentAngle = 360 / prizes.length;

        const segmentsHTML = prizes.map((prize, index) => {
            const rotation = segmentAngle * index;
            return `
                <div class="wheel-segment" style="transform: rotate(${rotation}deg) skewY(${segmentAngle - 90}deg);">
                    <span class="segment-label">🎁</span>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="custom-card rounded-lg shadow-xl w-full max-w-md p-6 m-4 fade-in text-center">
                <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">Parabéns!</h2>
                <p class="text-slate-600 dark:text-slate-400 mb-4">O cliente ganhou o direito de girar a roleta!</p>
                <div class="wheel-container">
                    <div class="wheel-pointer"></div>
                    <div class="wheel">${segmentsHTML}</div>
                    <div class="wheel-center"></div>
                </div>
                <button id="spin-wheel-btn" class="w-full bg-brand-secondary text-white py-3 px-4 rounded-md hover:bg-green-700 transition-colors text-lg font-bold">GIRAR A ROLETA</button>
            </div>
        `;
        modal.classList.remove('hidden');

        const spinBtn = modal.querySelector('#spin-wheel-btn');
        const wheel = modal.querySelector('.wheel');
        let isSpinning = false;
        
        spinBtn.addEventListener('click', async () => {
            if (isSpinning) return;
            isSpinning = true;
            spinBtn.disabled = true;
            spinBtn.textContent = 'GIRANDO...';

            await window.Tone.start(); 
            const synth = new window.Tone.Synth().toDestination();
            const notes = ["C4", "D4", "E4", "G4", "A4", "G4", "E4", "D4"];
            let noteIndex = 0;
            const loop = new window.Tone.Loop(time => {
                synth.triggerAttackRelease(notes[noteIndex % notes.length], "16n", time);
                noteIndex++;
            }, "16n").start(0);

            window.Tone.Transport.bpm.value = 180;
            window.Tone.Transport.start();

            const slowDownInterval = setInterval(() => {
                if (window.Tone.Transport.bpm.value > 40) {
                    window.Tone.Transport.bpm.value -= 5;
                } else {
                    clearInterval(slowDownInterval);
                }
            }, 200);

            let cumulativeProbability = 0;
            const weightedPrizes = prizes.map(p => ({ ...p, cumulative: cumulativeProbability += p.probability }));
            const random = Math.random() * 100;
            const winningPrize = weightedPrizes.find(p => random < p.cumulative) || prizes[prizes.length - 1];
            const winningIndex = prizes.findIndex(p => p.name === winningPrize.name);

            const randomOffset = (Math.random() - 0.5) * (segmentAngle * 0.8);
            const targetAngle = (winningIndex * segmentAngle) + (segmentAngle / 2) + randomOffset;
            const spinCycles = 5;
            const finalRotation = (360 * spinCycles) - targetAngle;

            wheel.style.transform = `rotate(${finalRotation}deg)`;

            setTimeout(async () => {
                loop.stop();
                window.Tone.Transport.stop();
                noteIndex = 0;
                clearInterval(slowDownInterval);

                try {
                    await updateDoc(doc(db, "sales", saleData.id), { prizeWon: winningPrize.name });
                    saleData.prizeWon = winningPrize.name;
                } catch (error) {
                    console.error("Erro ao atualizar a venda com o prêmio:", error);
                    showToast('Erro ao salvar o prêmio.', 'error');
                }

                modal.classList.add('hidden');
                showPrizeWonModal(winningPrize, saleData);

            }, 6000);
        });
    }

    function showWhatsAppModal(saleData) {
        const modal = document.getElementById('whatsapp-confirm-modal');
        if (!modal) return;

        const storeName = state.db.settings.storeName;
        const saleDate = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

        let itemsText = saleData.items.map(item =>
            `- ${item.name} (${item.exchange}) - ${formatCurrency(item.value)}`
        ).join('\n');

        let paymentText = (saleData.paymentMethods || [])
            .map(p => {
                let paymentString = `- ${p.method}: ${formatCurrency(p.amount)}`;
                if (p.installments) {
                    paymentString += ` (em ${p.installments})`;
                }
                return paymentString;
            })
            .join('\n');
        if (!paymentText) {
            paymentText = `- ${saleData.paymentMethod}: ${formatCurrency(saleData.total)}`;
        }

        let prizeText = '';
        if (saleData.prizeWon) {
            const isWinner = !saleData.prizeWon.toLowerCase().includes('tente novamente') && !saleData.prizeWon.toLowerCase().includes('não foi dessa vez');
            if (isWinner) {
                prizeText = `\n\n🎁 *Prêmio Ganho na Roleta!*\nParabéns! Você ganhou: *${saleData.prizeWon}*`;
            }
        }

        const couponText = `🧾 *Comprovante de Venda* 🧾\n\n*${storeName}*\n\n*Data:* ${saleDate}\n*Cliente:* ${saleData.clientName}\n\n*Itens:*\n${itemsText}\n\n*Pagamento:*\n${paymentText}\n\n*Total:* *${formatCurrency(saleData.total)}*\n*Vendedor:* ${state.loggedInUser.name}${prizeText}\n\nObrigado pela sua compra!`;

        const whatsAppNumber = saleData.clientPhone.replace(/\D/g, '');
        const encodedText = encodeURIComponent(couponText);
        const whatsappUrl = `https://wa.me/55${whatsAppNumber}?text=${encodedText}`;

        modal.innerHTML = `
            <div class="custom-card rounded-lg shadow-xl w-full max-w-md p-6 m-4 fade-in">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white">Venda Finalizada</h3>
                    <button id="close-whatsapp-modal" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-full">&times;</button>
                </div>
                <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">Deseja enviar o comprovante para o cliente via WhatsApp?</p>
                
                <div class="bg-slate-200/50 dark:bg-slate-800/50 p-4 rounded-md mb-6 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300 font-mono overflow-auto max-h-48">${couponText.replace(/\*/g, '')}</div>

                <div class="flex flex-col sm:flex-row justify-end gap-3">
                    <button id="close-whatsapp-modal-btn" class="bg-slate-200 dark:bg-slate-600 py-2 px-4 rounded-md">Fechar</button>
                    <button id="send-whatsapp-btn" class="bg-green-500 text-white py-2 px-4 rounded-md flex items-center justify-center gap-2 ${!whatsAppNumber ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'}" ${!whatsAppNumber ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943s-.182-.133-.38-.232z"/></svg>
                        Enviar via WhatsApp
                    </button>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');

        const close = () => modal.classList.add('hidden');
        modal.querySelector('#close-whatsapp-modal').addEventListener('click', close);
        modal.querySelector('#close-whatsapp-modal-btn').addEventListener('click', close);
        if (whatsAppNumber) {
            modal.querySelector('#send-whatsapp-btn').addEventListener('click', () => {
                window.open(whatsappUrl, '_blank');
                close();
            });
        }
    }
    
    // ... todas as outras funções render ...

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