// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, onSnapshot, doc, addDoc, deleteDoc, setDoc, query, where, writeBatch, Timestamp, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    // A configuração do Firebase permanece aqui.
    const firebaseConfig = {
        apiKey: "AIzaSyByZ1r41crqOadLXwHH2v9LgveyCkL6erE",
        authDomain: "pdv-vendas-8a65a.firebaseapp.com",
        projectId: "pdv-vendas-8a65a",
        storageBucket: "pdv-vendas-8a65a.appspot.com",
        messagingSenderId: "37533259212",
        appId: "1:37533259212:web:9e79fecb52aa2b4765b969",
        measurementId: "G-7PYWX52SEG"
    };

    // Inicialização do Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

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
                bonusSystem: { enabled: true, value: 80 },
                bonusWheel: { enabled: false, prizes: [], minValue: 0 },
                ownerPhone: '' // Novo campo para o Dashboard Inteligente
            },
            sales: []
        },
        listeners: { users: null, sales: null, stores: null, products: null, clients: null },
        selectedStore: null
    };
    let selectedUserForLogin = null;
    let vendasChartInstance = null;
    let pagamentoChartInstance = null;
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
                    bonusSystem: { enabled: true, value: 80 },
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
            await setDoc(settingsRef, {
                storeName: state.selectedStore.name,
                goals: { daily: 150, weekly: 1000, monthly: 4000 },
                bonusSystem: { enabled: true, value: 80 },
                bonusWheel: { enabled: false, prizes: [], minValue: 0 },
                ownerPhone: ''
            });
            state.db.settings.storeName = state.selectedStore.name;
            state.db.settings.goals = { daily: 150, weekly: 1000, monthly: 4000 };
            state.db.settings.bonusSystem = { enabled: true, value: 80 };
            state.db.settings.bonusWheel = { enabled: false, prizes: [], minValue: 0 };
            state.db.settings.ownerPhone = '';
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
    const showToast = (m, t = 'success') => { const e = document.createElement('div'); e.className = `fixed bottom-5 right-5 ${t === 'success' ? 'bg-brand-primary' : 'bg-red-600'} text-white py-2 px-4 rounded-lg shadow-lg z-[70] animate-bounce`; e.textContent = m; document.body.appendChild(e); setTimeout(() => e.remove(), 3000) };
    const showConfirmModal = (m, onConfirm) => { const M = document.getElementById('confirm-modal'); M.querySelector('#confirm-modal-message').textContent = m; M.classList.remove('hidden'); const c = M.querySelector('#confirm-modal-confirm'), n = M.querySelector('#confirm-modal-cancel'); const h = () => { onConfirm(); hide() }; const k = () => hide(); const hide = () => { M.classList.add('hidden'); c.removeEventListener('click', h); n.removeEventListener('click', k) }; c.addEventListener('click', h, { once: true }); n.addEventListener('click', k, { once: true }) };

    function exportToCSV(data, filename) {
        if (data.length === 0) {
            showToast('Nenhuma venda encontrada para exportar.', 'error');
            return;
        }

        const headers = [
            "Data da Compra", "ID da Venda", "Nome do Cliente", "Telefone do Cliente", "Vendedor",
            "Itens Vendidos", "Forma de Pagamento", "Total da Venda", "Bônus da Venda"
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
            sale.bonus
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
        if (state.listeners.users) state.listeners.users();
        if (state.listeners.sales) state.listeners.sales();
        if (state.listeners.stores) state.listeners.stores();
        if (state.listeners.products) state.listeners.products();
        if (state.listeners.clients) state.listeners.clients();
        state.listeners = { users: null, sales: null, stores: null, products: null, clients: null };
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
        
        if (state.listeners.products) state.listeners.products();
        const productsQuery = query(collection(db, "products"), where("storeId", "==", store.id));
        state.listeners.products = onSnapshot(productsQuery, (snapshot) => {
            state.db.products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (state.currentView === 'produtos' && document.getElementById('produtos-view').classList.contains('active')) {
                renderProdutos();
            }
        }, (error) => {
            console.error("Erro ao carregar produtos (verifique suas Regras de Segurança do Firestore):", error);
            showToast('Erro ao carregar produtos. Verifique as permissões.', 'error');
        });

        if (state.listeners.clients) state.listeners.clients();
        const clientsQuery = query(collection(db, "clients"), where("storeId", "==", store.id));
        state.listeners.clients = onSnapshot(clientsQuery, (snapshot) => {
            state.db.clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (state.currentView === 'clientes' && document.getElementById('clientes-view').classList.contains('active')) {
                renderClientes();
            }
        }, (error) => {
            console.error("Erro ao carregar clientes:", error);
            showToast('Erro ao carregar clientes.', 'error');
        });

        // NOVO: Listener geral de vendas para alimentar os filtros de clientes.
        if (state.listeners.sales) state.listeners.sales();
        const salesQuery = query(collection(db, "sales"), where("storeId", "==", store.id));
        state.listeners.sales = onSnapshot(salesQuery, (snapshot) => {
            state.db.sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }, (error) => {
            console.error("Erro ao carregar dados de vendas:", error);
        });


        const switcherContainer = document.getElementById('store-switcher-container');
        if (user.role === 'superadmin') {
            if (state.listeners.stores) state.listeners.stores();
            state.listeners.stores = onSnapshot(query(collection(db, "stores")), (snapshot) => {
                state.db.stores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const select = document.getElementById('store-switcher-select');
                if (select) {
                    const currentStoreId = state.selectedStore ? state.selectedStore.id : state.db.stores[0].id;
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
                
                if (state.listeners.products) state.listeners.products();
                if (state.listeners.clients) state.listeners.clients();
                if (state.listeners.sales) state.listeners.sales();

                state.listeners.products = onSnapshot(query(collection(db, "products"), where("storeId", "==", state.selectedStore.id)), (snapshot) => {
                    state.db.products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                });
                
                state.listeners.clients = onSnapshot(query(collection(db, "clients"), where("storeId", "==", state.selectedStore.id)), (snapshot) => {
                    state.db.clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                });

                state.listeners.sales = onSnapshot(query(collection(db, "sales"), where("storeId", "==", state.selectedStore.id)), (snapshot) => {
                    state.db.sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                });
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
        if (!document.getElementById(`${viewId}-template`)) {
            console.error(`Template para a view "${viewId}" não encontrado.`);
            return;
        }
        viewContainer.innerHTML = document.getElementById(`${viewId}-template`).innerHTML;

        if (['pedidos', 'produtos', 'clientes'].includes(viewId)) {
            const table = viewContainer.querySelector('table');
            if (table) {
                if (!table.parentElement.classList.contains('table-responsive-wrapper')) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'overflow-x-auto table-responsive-wrapper';
                    table.parentNode.insertBefore(wrapper, table);
                    wrapper.appendChild(table);
                }
            }
        }

        window.lucide.createIcons();
        switch (viewId) {
            case 'caixa': renderCaixa(); break;
            case 'pedidos': renderPedidos(); break;
            case 'clientes': renderClientes(); break;
            case 'produtos': renderProdutos(); break;
            case 'metas': renderMetas(); break;
            case 'ranking': renderRanking(); break;
            case 'relatorios': renderDashboard(); break;
            case 'configuracoes': renderConfiguracoes(); break;
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

        const couponText = `🧾 *Comprovante de Venda* 🧾\n\n*${storeName}*\n\n*Data:* ${saleDate}\n*Cliente:* ${saleData.clientName}\n\n*Itens:*\n${itemsText}\n\n*Pagamento:*\n${paymentText}\n\n*Total:* *${formatCurrency(saleData.total)}*\n*Vendedor:* ${saleData.vendedor}${prizeText}\n\nObrigado pela sua compra!`;

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

    function renderCaixa() {
        const view = document.getElementById('caixa-view');
        const itemsContainer = view.querySelector('#current-order-items');
        const totalEl = view.querySelector('#current-order-total');
        const finalizeBtn = view.querySelector('#finalize-order-button');
        const addForm = view.querySelector('#add-item-form');
        const modalContainer = document.getElementById('finalize-order-modal');
        
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
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
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
                exchange: view.querySelector('#item-exchange').value
            };
            
            if (selectedProduct) {
                newItem.productId = selectedProduct.id;
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
            modalContainer.classList.remove('hidden');
            const orderTotal = state.currentOrder.reduce((sum, i) => sum + i.value, 0);

            modalContainer.innerHTML = `
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
                </div>`;
            
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

            modalContainer.querySelector('#cancel-finalize-button').addEventListener('click', () => modalContainer.classList.add('hidden'));

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
                let bonus = 0;
                const bonusConfig = state.db.settings.bonusSystem;
                if (bonusConfig && bonusConfig.enabled && bonusConfig.value > 0) {
                    bonus = Math.floor(total / bonusConfig.value) * 2;
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
                    bonus: bonus,
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
                    modalContainer.classList.add('hidden');

                    const wheelConfig = state.db.settings.bonusWheel;
                    if (wheelConfig && wheelConfig.enabled && wheelConfig.prizes && wheelConfig.prizes.length > 0 && total >= (wheelConfig.minValue || 0)) {
                        showBonusWheelModal(saleData);
                    } else if (saleData.clientPhone) {
                        showWhatsAppModal(saleData);
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
    
    // ====================================================================================================
    // FUNÇÃO renderClientes TOTALMENTE REFEITA PARA INCLUIR FILTROS E BOTÃO WHATSAPP
    // ====================================================================================================
    function renderClientes() {
        const view = document.getElementById('clientes-view');
        const form = view.querySelector('#add-client-form');
        const tableBody = view.querySelector('#clients-table-body');
        const searchInput = view.querySelector('#client-search');
        const clientCountEl = view.querySelector('#client-count');
        
        // Novos elementos do filtro
        const clientFilterForm = view.querySelector('#client-filter-form');
        const filterDateInput = view.querySelector('#filter-last-purchase');
        const filterProductInput = view.querySelector('#filter-product-purchased');

        let currentEditingId = null;

        const resetForm = () => {
            form.reset();
            form.querySelector('#client-form-id').value = '';
            view.querySelector('#client-form-title').textContent = 'Adicionar Novo Cliente';
            view.querySelector('#client-form-btn-text').textContent = 'Salvar Cliente';
            view.querySelector('#client-form-cancel').classList.add('hidden');
            currentEditingId = null;
        };

        const renderClientsTable = (clients) => {
            tableBody.innerHTML = '';
            const clientsToRender = clients || state.db.clients;
            
            clientCountEl.textContent = `${clientsToRender.length} cliente(s) encontrado(s).`;

            if (clientsToRender.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-slate-500">Nenhum cliente encontrado.</td></tr>`;
                return;
            }

            const sortedClients = [...clientsToRender].sort((a, b) => a.name.localeCompare(b.name));

            sortedClients.forEach(client => {
                const row = `
                    <tr class="bg-white/50 dark:bg-slate-900/50 border-b border-slate-300 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800/50">
                        <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">${client.name}</td>
                        <td class="px-6 py-4">${client.phone || 'N/A'}</td>
                        <td class="px-6 py-4 text-center">
                            ${client.phone ? `<button data-client-id="${client.id}" data-client-phone="${client.phone}" class="whatsapp-client-btn text-green-500 hover:text-green-700" title="Enviar WhatsApp"><i class="w-5 h-5 pointer-events-none" data-lucide="message-circle"></i></button>` : `<span class="text-xs text-slate-400">Sem Tel.</span>`}
                        </td>
                        <td class="px-6 py-4 text-center space-x-2">
                            <button data-client-id="${client.id}" class="view-client-btn text-blue-500 hover:text-blue-700" title="Ver Detalhes"><i data-lucide="eye" class="w-4 h-4 pointer-events-none"></i></button>
                            <button data-client-id="${client.id}" class="edit-client-btn text-amber-500 hover:text-amber-700" title="Editar"><i data-lucide="edit-2" class="w-4 h-4 pointer-events-none"></i></button>
                            <button data-client-id="${client.id}" class="remove-client-btn text-red-500 hover:text-red-700" title="Remover"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
            window.lucide.createIcons();
        };

        // Lógica de busca simples (nome/telefone)
        searchInput.addEventListener('input', () => {
            const term = searchInput.value.toLowerCase();
            clientFilterForm.reset(); // Limpa os filtros avançados ao usar a busca simples
            if (term.length === 0) {
                renderClientsTable(state.db.clients);
                return;
            }
            const filteredClients = state.db.clients.filter(c => 
                c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term))
            );
            renderClientsTable(filteredClients);
        });

        // Lógica dos Filtros Avançados
        clientFilterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dateValue = filterDateInput.value;
            const productValue = filterProductInput.value.toLowerCase().trim();

            if (!dateValue && !productValue) {
                showToast('Preencha ao menos um campo para filtrar.', 'error');
                return;
            }

            tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-slate-500">Filtrando clientes...</td></tr>`;
            searchInput.value = '';

            let filteredSales = state.db.sales;

            if (dateValue) {
                const startDate = new Date(dateValue + 'T00:00:00');
                const endDate = new Date(dateValue + 'T23:59:59');
                filteredSales = filteredSales.filter(sale => {
                    const saleDate = sale.date.toDate();
                    return saleDate >= startDate && saleDate <= endDate;
                });
            }

            if (productValue) {
                filteredSales = filteredSales.filter(sale => 
                    sale.items.some(item => item.name.toLowerCase().includes(productValue))
                );
            }

            const clientIdsFromSales = [...new Set(filteredSales.map(sale => sale.clientId).filter(id => id))];
            
            const finalClients = state.db.clients.filter(client => clientIdsFromSales.includes(client.id));
            
            renderClientsTable(finalClients);
        });
        
        clientFilterForm.addEventListener('reset', () => {
            renderClientsTable(state.db.clients);
        });

        // Lógica do formulário de Adicionar/Editar Cliente
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const clientData = {
                name: view.querySelector('#client-form-name').value,
                phone: view.querySelector('#client-form-phone').value,
                email: view.querySelector('#client-form-email').value,
                address: view.querySelector('#client-form-address').value,
                storeId: state.selectedStore.id
            };

            try {
                if (currentEditingId) {
                    await setDoc(doc(db, "clients", currentEditingId), clientData);
                    showToast('Cliente atualizado com sucesso!', 'success');
                } else {
                    await addDoc(collection(db, "clients"), clientData);
                    showToast('Cliente adicionado com sucesso!', 'success');
                }
                resetForm();
            } catch (error) {
                console.error("Erro ao salvar cliente:", error);
                showToast('Erro ao salvar cliente.', 'error');
            }
        });
        
        form.addEventListener('reset', resetForm);

        // Lógica dos botões na tabela (Detalhes, Editar, Excluir, WhatsApp)
        tableBody.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            
            const clientId = btn.dataset.clientId;

            if (btn.classList.contains('whatsapp-client-btn')) {
                const phone = btn.dataset.clientPhone.replace(/\D/g, '');
                const client = state.db.clients.find(c => c.id === clientId);
                const message = encodeURIComponent(`Olá, ${client.name}! Temos uma novidade para você na ${state.db.settings.storeName}.`);
                window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
            } else if (btn.classList.contains('remove-client-btn')) {
                showConfirmModal('Tem certeza que deseja remover este cliente? A ação não pode ser desfeita.', async () => {
                    try {
                        await deleteDoc(doc(db, "clients", clientId));
                        showToast('Cliente removido!', 'success');
                    } catch (error) { showToast('Erro ao remover cliente.', 'error'); }
                });
            } else if (btn.classList.contains('edit-client-btn')) {
                const client = state.db.clients.find(c => c.id === clientId);
                if(client) {
                    currentEditingId = client.id;
                    view.querySelector('#client-form-id').value = client.id;
                    view.querySelector('#client-form-name').value = client.name;
                    view.querySelector('#client-form-phone').value = client.phone || '';
                    view.querySelector('#client-form-email').value = client.email || '';
                    view.querySelector('#client-form-address').value = client.address || '';
                    view.querySelector('#client-form-title').textContent = 'Editando Cliente';
                    view.querySelector('#client-form-btn-text').textContent = 'Atualizar';
                    view.querySelector('#client-form-cancel').classList.remove('hidden');
                    view.querySelector('#client-form-name').focus();
                }
            } else if (btn.classList.contains('view-client-btn')) {
                 const client = state.db.clients.find(c => c.id === clientId);
                 const clientSales = state.db.sales.filter(sale => sale.clientId === clientId);

                 const modal = document.getElementById('client-details-modal');
                 modal.classList.remove('hidden');

                 const totalSpent = clientSales.reduce((acc, sale) => acc + sale.total, 0);

                 let salesHTML = '<p class="text-sm text-slate-500">Nenhuma compra registrada.</p>';
                 if (clientSales.length > 0) {
                      salesHTML = `<ul class="space-y-2 text-sm max-h-60 overflow-y-auto pr-2">` + clientSales.sort((a,b) => b.date.seconds - a.date.seconds).map(sale => `
                          <li class="p-2 bg-slate-200/50 dark:bg-slate-800/50 rounded-md">
                              <div class="flex justify-between font-semibold">
                                  <span>${formatDate(sale.date)}</span>
                                  <span>${formatCurrency(sale.total)}</span>
                              </div>
                              <ul class="list-disc list-inside text-xs text-slate-600 dark:text-slate-400">
                                  ${sale.items.map(item => `<li>${item.name}</li>`).join('')}
                              </ul>
                          </li>
                      `).join('') + `</ul>`;
                 }

                 modal.innerHTML = `
                   <div class="custom-card rounded-lg shadow-xl w-full max-w-2xl p-6 m-4 fade-in">
                       <div class="flex justify-between items-center border-b dark:border-slate-700 pb-3 mb-4">
                           <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">${client.name}</h2>
                           <button id="close-client-details-modal" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><i data-lucide="x" class="w-6 h-6"></i></button>
                       </div>
                       <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div>
                               <h4 class="font-bold mb-2">Informações de Contato</h4>
                               <p><strong class="font-medium">Telefone:</strong> ${client.phone || 'N/A'}</p>
                               <p><strong class="font-medium">Email:</strong> ${client.email || 'N/A'}</p>
                               <p><strong class="font-medium">Endereço:</strong> ${client.address || 'N/A'}</p>
                               <hr class="my-3 dark:border-slate-700">
                               <h4 class="font-bold">Total Gasto na Loja:</h4>
                               <p class="text-xl font-bold text-brand-primary">${formatCurrency(totalSpent)}</p>
                           </div>
                           <div>
                               <h4 class="font-bold mb-2">Histórico de Compras (${clientSales.length})</h4>
                               ${salesHTML}
                           </div>
                       </div>
                   </div>
                 `;
                 window.lucide.createIcons();
                 modal.querySelector('#close-client-details-modal').addEventListener('click', () => modal.classList.add('hidden'));
            }
        });
        
        renderClientsTable();
    }
    
    document.getElementById('app').addEventListener('submit', async (e) => {
        if (e.target.id === 'add-product-form') {
            e.preventDefault();
            const form = e.target;
            const name = form.querySelector('#product-name').value;
            const price = parseFloat(form.querySelector('#product-price').value);
            const quantity = parseInt(form.querySelector('#product-quantity').value);

            if (!name || isNaN(price) || isNaN(quantity)) {
                showToast('Por favor, preencha todos os campos corretamente.', 'error');
                return;
            }

            try {
                await addDoc(collection(db, "products"), {
                    name,
                    price,
                    quantity,
                    storeId: state.selectedStore.id
                });
                showToast('Produto adicionado com sucesso!', 'success');
                form.reset();
            } catch (error) {
                console.error("Erro ao adicionar produto:", error);
                showToast('Erro ao adicionar produto.', 'error');
            }
        }
    });

    document.getElementById('app').addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-product-btn');
        if (removeBtn) {
            const productId = removeBtn.dataset.productId;
            showConfirmModal('Tem certeza que deseja remover este produto? A ação não pode ser desfeita.', async () => {
                try {
                    await deleteDoc(doc(db, "products", productId));
                    showToast('Produto removido com sucesso!', 'success');
                } catch (error) {
                    console.error("Erro ao remover produto:", error);
                    showToast('Erro ao remover produto.', 'error');
                }
            });
        }
    });

    function renderProdutos() {
        const view = document.getElementById('produtos-view');
        const tableBody = view.querySelector('#products-table-body');

        const renderProductsTable = () => {
            tableBody.innerHTML = '';
            if (state.db.products.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-slate-500">Nenhum produto cadastrado.</td></tr>`;
                return;
            }

            const sortedProducts = [...state.db.products].sort((a, b) => a.name.localeCompare(b.name));

            sortedProducts.forEach(product => {
                const stockClass = product.quantity <= 5 ? 'text-red-500 font-bold' : (product.quantity <= 10 ? 'text-amber-500 font-semibold' : '');
                const row = `
                    <tr class="bg-white/50 dark:bg-slate-900/50 border-b border-slate-300 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800/50">
                        <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">${product.name}</td>
                        <td class="px-6 py-4 text-center ${stockClass}">${product.quantity}</td>
                        <td class="px-6 py-4 text-right">${formatCurrency(product.price)}</td>
                        <td class="px-6 py-4 text-center">
                            <button data-product-id="${product.id}" class="remove-product-btn text-red-500 hover:text-red-700">
                                <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                            </button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
            window.lucide.createIcons();
        };

        renderProductsTable();
    }
    
    function renderPedidos() {
        const c = document.getElementById('pedidos-view');
        const isGerente = state.loggedInUser.role === 'gerente' || state.loggedInUser.role === 'superadmin';

        if (isGerente) {
            c.querySelector('#vendedor-pedidos-dashboard')?.classList.add('hidden');
            c.querySelector('#gerente-vendedor-filter-container').classList.remove('hidden');
            if (!c.querySelector('#orders-table-header-row').innerText.includes('Vendedor')) {
                c.querySelector('#orders-table-header-row').insertAdjacentHTML('afterbegin', '<th scope="col" class="px-6 py-3">Vendedor</th>');
            }
            const select = c.querySelector('#filter-vendedor');
            select.innerHTML = '<option value="Todos">Todos</option>';
            const storeUsers = state.db.users.filter(u => u.storeId === state.selectedStore.id && u.role === 'vendedor');
            const vendedores = [...new Set(storeUsers.map(u => u.name))];
            vendedores.forEach(name => {
                select.innerHTML += `<option value="${name}">${name}</option>`;
            });
        }

        const updateDashboard = (sales) => {
            if (isGerente) return;
            const totalSales = sales.length;
            const totalValue = sales.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
            c.querySelector('#pedidos-finalizados').textContent = totalSales;
            c.querySelector('#valor-total').textContent = formatCurrency(totalValue);
            c.querySelector('#ticket-medio').textContent = formatCurrency(totalSales > 0 ? totalValue / totalSales : 0);
        };

        const renderTable = (sales) => {
            const tbody = c.querySelector('#orders-table-body');
            tbody.innerHTML = '';
            if (!sales || sales.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="text-center p-8 text-slate-500">Nenhum pedido encontrado.</td></tr>';
            } else {
                sales.forEach(s => {
                    const r = document.createElement('tr');
                    r.className = 'bg-white/50 dark:bg-slate-900/50 border-b border-slate-300 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800/50';
                    
                    const paymentDisplay = Array.isArray(s.paymentMethods)
                        ? s.paymentMethods.map(p => {
                            let paymentString = p.method;
                            if (p.installments) {
                                paymentString += ` (${p.installments})`;
                            }
                            return paymentString;
                        }).join(' + ')
                        : s.paymentMethod;

                    r.innerHTML =
                        `${isGerente ? `<td class="px-6 py-4">${s.vendedor}</td>` : ''}
                            <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">${s.clientName}</td>
                            <td class="px-6 py-4">${new Date(s.date.seconds * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                            <td class="px-6 py-4">${paymentDisplay}</td>
                            <td class="px-6 py-4 text-right font-semibold text-slate-800 dark:text-slate-100">${formatCurrency(s.total)}</td>
                            <td class="px-6 py-4 text-center">
                                <button data-order-id="${s.id}" class="view-details-btn text-brand-primary hover:underline">Detalhes</button>
                            </td>`;
                    tbody.appendChild(r);
                });
            }
        };
        
        const applyFiltersAndFetchSales = () => {
            // Este listener agora é mais específico para a tela de pedidos.
            const ordersListener = () => {};
            if (state.listeners.orders) state.listeners.orders();

            const dateFilter = c.querySelector('#filter-date').value;
            const paymentFilter = c.querySelector('#filter-payment').value;
            const vendedorFilter = isGerente ? c.querySelector('#filter-vendedor').value : null;

            let conditions = [where("storeId", "==", state.selectedStore.id)];

            if (isGerente) {
                if (vendedorFilter && vendedorFilter !== 'Todos') {
                    conditions.push(where("vendedor", "==", vendedorFilter));
                }
            } else {
                conditions.push(where("vendedor", "==", state.loggedInUser.name));
            }
            
            if (paymentFilter && paymentFilter !== 'Todos') {
                conditions.push(where("paymentMethodTypes", "array-contains", paymentFilter));
            }

            if (dateFilter) {
                const startDate = Timestamp.fromDate(new Date(dateFilter + 'T00:00:00'));
                const endDate = Timestamp.fromDate(new Date(dateFilter + 'T23:59:59'));
                conditions.push(where("date", ">=", startDate));
                conditions.push(where("date", "<=", endDate));
            }
            
            const finalQuery = query(collection(db, "sales"), ...conditions);

            state.listeners.orders = onSnapshot(finalQuery, (snapshot) => {
                let sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                sales.sort((a, b) => b.date.seconds - a.date.seconds);
                renderTable(sales);
                if (!isGerente) {
                    updateDashboard(sales);
                }
            }, (error) => {
                console.error("Erro ao buscar pedidos: ", error);
                c.querySelector('#orders-table-body').innerHTML = `<tr><td colspan="10" class="text-center p-8 text-red-500"><b>Erro ao carregar pedidos.</b><br><span class="text-xs">Pode ser necessário criar um índice no Firestore. Verifique o console de depuração para um link de criação.</span></td></tr>`;
            });
        };

        c.querySelector('#filter-form').addEventListener('submit', e => { e.preventDefault(); applyFiltersAndFetchSales(); });
        c.querySelector('#filter-form').addEventListener('reset', () => { setTimeout(applyFiltersAndFetchSales, 0); });
        
        applyFiltersAndFetchSales();

        c.querySelector('#orders-table-body').addEventListener('click', e => {
            const b = e.target.closest('.view-details-btn');
            if (b) {
                const order = state.db.sales.find(s => s.id == b.dataset.orderId);
                if (order) {
                    const m = document.getElementById('order-details-modal');
                    m.classList.remove('hidden');
                    const itemsList = order.items.map(i => `<li>${i.productId ? '<i class="inline-block" data-lucide="package"></i> ' : ''}${i.name} (${formatCurrency(i.value)})</li>`).join('');
                    
                    const paymentDetails = Array.isArray(order.paymentMethods)
                        ? order.paymentMethods.map(p => {
                            let paymentString = `<li>${p.method}: ${formatCurrency(p.amount)}`;
                            if(p.installments) {
                                paymentString += ` (em ${p.installments})`;
                            }
                            paymentString += `</li>`;
                            return paymentString;
                        }).join('')
                        : `<li>${order.paymentMethod}: ${formatCurrency(order.total)}</li>`;
                    
                             let prizeDetails = '';
                             if(order.prizeWon){
                                  prizeDetails = `<hr class="my-2 dark:border-slate-700"><p><strong>Prêmio Ganho:</strong> ${order.prizeWon}</p>`;
                             }

                    m.innerHTML = `<div class="custom-card rounded-lg shadow-xl w-full max-w-lg p-6 m-4 fade-in"><div class="flex justify-between items-center border-b dark:border-slate-700 pb-3 mb-4"><h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Detalhes do Pedido</h2><button id="close-details-modal" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><i data-lucide="x" class="w-6 h-6"></i></button></div><div><p><strong>Cliente:</strong> ${order.clientName}</p><p><strong>Telefone:</strong> ${order.clientPhone || 'Não informado'}</p><p><strong>Data:</strong> ${new Date(order.date.seconds * 1000).toLocaleString('pt-BR')}</p><p><strong>Vendedor:</strong> ${order.vendedor}</p><hr class="my-2 dark:border-slate-700"><p><strong>Itens:</strong></p><ul class="list-disc list-inside ml-4">${itemsList}</ul><hr class="my-2 dark:border-slate-700"><p><strong>Pagamento:</strong></p><ul class="list-disc list-inside ml-4">${paymentDetails}</ul><p class="text-lg font-bold mt-2"><strong>Total:</strong> ${formatCurrency(order.total)}</p>${prizeDetails}</div></div>`;
                    m.querySelector('#close-details-modal').addEventListener('click', () => m.classList.add('hidden'));
                    window.lucide.createIcons();
                }
            }
        });
    }

    function renderMetas(){
        const c = document.getElementById('metas-view');
        if (!c) return;

        const goals = state.db.settings.goals || {};

        const updateGoalsUI = (sales) => {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            const dayOfWeek = now.getDay();
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const weekStart = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
            
            const vendasHoje = sales.filter(s => s.date.toDate().getTime() >= todayStart.getTime()).reduce((sum, s) => sum + s.total, 0);
            const vendasSemana = sales.filter(s => s.date.toDate().getTime() >= weekStart.getTime()).reduce((sum, s) => sum + s.total, 0);
            const vendasMes = sales.filter(s => s.date.toDate().getTime() >= monthStart.getTime()).reduce((sum, s) => sum + s.total, 0);

            const salesByDay = sales.reduce((acc, s) => {
                const saleDate = s.date.toDate();
                const dayKey = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate()).toISOString().split('T')[0];
                acc[dayKey] = (acc[dayKey] || 0) + s.total;
                return acc;
            }, {});

            const melhorDiaValor = Math.max(0, ...Object.values(salesByDay));

            const getWeekIdentifier = (d) => {
                const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
                const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
                const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
                return `${date.getUTCFullYear()}-W${weekNo}`;
            }

            const salesByWeek = sales.reduce((acc, s) => {
                const week = getWeekIdentifier(s.date.toDate());
                acc[week] = (acc[week] || 0) + s.total;
                return acc;
            }, {});
            const melhorSemanaValor = Math.max(0, ...Object.values(salesByWeek));
            
            let streak = 0;
            let currentDay = new Date(new Date().setHours(0,0,0,0));
            for(let i = 0; i < 365; i++){
                const dayKey = currentDay.toISOString().split('T')[0];
                const daySales = salesByDay[dayKey] || 0;
                if (daySales >= (goals.daily || 0.01)) {
                    streak++;
                } else {
                    if (currentDay.getTime() < todayStart.getTime()) {
                        break;
                    }
                }
                currentDay.setDate(currentDay.getDate() - 1);
            }

            const updateProgressBar = (barId, textId, current, goal) => {
                const bar = document.getElementById(barId);
                const text = document.getElementById(textId);
                if(bar && text) {
                    const percentage = Math.min(100, (current / (goal || 1)) * 100);
                    bar.style.width = `${percentage}%`;
                    text.textContent = `${formatCurrency(current)} / ${formatCurrency(goal)}`;
                }
            }
            
            updateProgressBar('progresso-diario-barra', 'progresso-diario-texto', vendasHoje, goals.daily);
            updateProgressBar('progresso-semanal-barra', 'progresso-semanal-texto', vendasSemana, goals.weekly);
            updateProgressBar('progresso-mensal-barra', 'progresso-mensal-texto', vendasMes, goals.monthly);
            document.getElementById('recorde-dias-consecutivos').textContent = streak;
            document.getElementById('recorde-melhor-dia').textContent = formatCurrency(melhorDiaValor);
            document.getElementById('recorde-melhor-semana').textContent = formatCurrency(melhorSemanaValor);
        };
        
        const storeId = state.selectedStore.id;
        const q = query(collection(db, "sales"), where("vendedor", "==", state.loggedInUser.name), where("storeId", "==", storeId));
        state.listeners.metas = onSnapshot(q, (snapshot) => {
            const mySales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            mySales.sort((a, b) => b.date.seconds - a.date.seconds);
            updateGoalsUI(mySales);
        }, (error) => {
            console.error("Erro ao buscar metas: ", error);
            c.innerHTML = `<div class="text-center p-8 text-red-500"><b>Erro:</b> Não foi possível carregar os dados de metas.</div>`;
        });
    }

    function renderRanking() {
        if (state.listeners.ranking) state.listeners.ranking();
        
        const view = document.getElementById('ranking-view');
        const podiumContainer = view.querySelector('#ranking-podium-container');
        const listContainer = view.querySelector('#ranking-list-container');
        let currentPeriod = 'day';

        const updateRankingUI = (sales, period) => {
            const now = new Date();
            let startDate;

            switch (period) {
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'week':
                    const dayOfWeek = now.getDay();
                    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                    startDate = new Date(now.setDate(diff));
                    break;
                case 'day':
                default:
                    startDate = new Date();
                    break;
            }
            startDate.setHours(0, 0, 0, 0);

            const filteredSales = sales.filter(s => s.date.toDate() >= startDate);
            
            const salesBySeller = filteredSales.reduce((acc, sale) => {
                acc[sale.vendedor] = (acc[sale.vendedor] || 0) + sale.total;
                return acc;
            }, {});
            
            const sellersFromUsers = state.db.users.filter(u => u.role === 'vendedor' && u.storeId === state.selectedStore.id);
            sellersFromUsers.forEach(seller => {
                if (!salesBySeller[seller.name]) {
                    salesBySeller[seller.name] = 0;
                }
            });

            const rankedSellers = Object.entries(salesBySeller)
                .map(([name, total]) => ({ name, total }))
                .sort((a, b) => b.total - a.total);

            podiumContainer.innerHTML = '';
            listContainer.innerHTML = '';

            if (rankedSellers.length === 0) {
                podiumContainer.innerHTML = '<p class="text-center text-slate-500 dark:text-slate-400 col-span-full mt-12">Nenhum vendedor para classificar.</p>';
                return;
            }
            
            const top3 = rankedSellers.slice(0, 3);
            const others = rankedSellers.slice(3);
            
            const podiumOrder = [1, 0, 2];
            const podiumHTML = `
                <div class="flex flex-col sm:flex-row justify-center items-end gap-4 sm:gap-2 md:gap-4">
                    ${podiumOrder.map(index => {
                        const seller = top3[index];
                        if (!seller) return '<div class="w-full sm:w-1/3"></div>';
                        
                        const heightClasses = ['h-40 sm:h-48', 'h-28 sm:h-32', 'h-20 sm:h-24'];
                        const place = index + 1;
                        const barHeight = place === 1 ? heightClasses[0] : (place === 2 ? heightClasses[1] : heightClasses[2]);
                        const colorClasses = [
                            'bg-amber-400 dark:bg-amber-500',
                            'bg-slate-300 dark:bg-slate-400',
                            'bg-yellow-600 dark:bg-yellow-700'
                        ];

                        return `
                        <div class="w-full sm:w-1/3 text-center flex flex-col items-center">
                            <div class="relative mb-2">
                                <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-3xl sm:text-4xl font-bold border-4 ${place === 1 ? 'border-amber-400' : 'border-slate-400 dark:border-slate-500'}">
                                    ${seller.name.charAt(0)}
                                </div>
                                <div class="absolute -top-2 -right-2 w-8 h-8 bg-slate-800 text-white rounded-full flex items-center justify-center text-sm font-bold border-2 border-white dark:border-slate-900">${place}</div>
                            </div>
                            <p class="font-bold text-slate-800 dark:text-white truncate w-full">${seller.name}</p>
                            <p class="text-sm text-brand-primary font-semibold">${formatCurrency(seller.total)}</p>
                            <div class="w-full ${barHeight} ${colorClasses[index]} rounded-t-lg mt-2 flex items-center justify-center">
                                <i data-lucide="award" class="w-10 h-10 text-white/50"></i>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            `;
            podiumContainer.innerHTML = podiumHTML;

            if(others.length > 0) {
                const listHTML = `
                    <ul class="space-y-2">
                        ${others.map((seller, index) => `
                            <li class="flex items-center justify-between p-3 bg-slate-200/50 dark:bg-slate-800/50 rounded-lg">
                                <div class="flex items-center gap-3">
                                    <span class="font-bold text-slate-500 dark:text-slate-400">${index + 4}</span>
                                    <div class="w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                                        ${seller.name.charAt(0)}
                                    </div>
                                    <span class="font-medium text-slate-800 dark:text-slate-200">${seller.name}</span>
                                </div>
                                <span class="font-semibold text-brand-primary">${formatCurrency(seller.total)}</span>
                            </li>
                        `).join('')}
                    </ul>
                `;
                listContainer.innerHTML = listHTML;
            } else if (rankedSellers.length > 3) {
                 listContainer.innerHTML = '<p class="text-center text-sm text-slate-500 p-4">...</p>';
            }
            window.lucide.createIcons();
        };
        
        const q = query(collection(db, "sales"), where("storeId", "==", state.selectedStore.id));
        state.listeners.ranking = onSnapshot(q, (snapshot) => {
            const allSales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateRankingUI(allSales, currentPeriod);
        }, (error) => {
             console.error("Erro ao carregar ranking:", error);
             podiumContainer.innerHTML = '<p class="text-center text-red-500">Erro ao carregar dados do ranking.</p>';
        });

        view.querySelectorAll('.ranking-period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentPeriod = e.target.dataset.period;
                view.querySelectorAll('.ranking-period-btn').forEach(b => b.classList.remove('bg-white', 'dark:bg-slate-900', 'text-brand-primary', 'shadow'));
                e.target.classList.add('bg-white', 'dark:bg-slate-900', 'text-brand-primary', 'shadow');
                
                const q = query(collection(db, "sales"), where("storeId", "==", state.selectedStore.id));
                getDocs(q).then(snapshot => {
                     const allSales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                     updateRankingUI(allSales, currentPeriod);
                });
            });
        });
    }

    function renderDashboard() {
        const c = document.getElementById('relatorios-view');
        if (!c) return;
        const isManager = state.loggedInUser.role === 'gerente' || state.loggedInUser.role === 'superadmin';

        // Bloco ÚNICO e CORRIGIDO para a seção de Análise com IA
        const aiSection = c.querySelector('#ai-analysis-section');
        if (aiSection) {
            // 1. Controla a visibilidade da seção inteira baseado na função do usuário
            aiSection.classList.toggle('hidden', !isManager);

            // 2. Adiciona o listener do botão apenas se a seção for visível
            if (isManager) {
                const generateAiBtn = aiSection.querySelector('#generate-ai-analysis-btn');
                const aiResultContainer = aiSection.querySelector('#ai-analysis-result-container');

                if (generateAiBtn && aiResultContainer) {
                    // Remove listener antigo para evitar duplicação em re-renderizações
                    const newGenerateAiBtn = generateAiBtn.cloneNode(true);
                    generateAiBtn.parentNode.replaceChild(newGenerateAiBtn, generateAiBtn);

                    newGenerateAiBtn.addEventListener('click', () => {
                        const selectedVendedor = isManager ? c.querySelector('#relatorios-vendedor-select')?.value : 'total';
                        const salesData = selectedVendedor === 'total' || !isManager
                            ? state.db.sales
                            : state.db.sales.filter(s => s.vendedor === selectedVendedor);

                        if (salesData.length === 0) {
                            aiResultContainer.innerHTML = `<p class="text-amber-600 dark:text-amber-400">Não há dados de vendas suficientes para gerar uma análise.</p>`;
                            return;
                        }

                        newGenerateAiBtn.disabled = true;
                        aiResultContainer.innerHTML = `
                            <div class="flex items-center gap-2 text-slate-500">
                                <div class="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-brand-primary"></div>
                                Analisando dados e gerando insights...
                            </div>
                        `;

                        setTimeout(() => {
                            const totalSales = salesData.reduce((sum, s) => sum + s.total, 0);
                            const numOrders = salesData.length;
                            const avgTicket = totalSales / numOrders;
                            const salesByDay = salesData.reduce((acc, s) => {
                                const day = s.date.toDate().toLocaleDateString('pt-BR');
                                acc[day] = (acc[day] || 0) + s.total;
                                return acc;
                            }, {});
                            const bestDay = Object.entries(salesByDay).sort((a, b) => b[1] - a[1])[0];
                            const paymentMethods = salesData.flatMap(s => s.paymentMethods || [{ method: s.paymentMethod }])
                                .reduce((acc, p) => { acc[p.method] = (acc[p.method] || 0) + 1; return acc; }, {});
                            const mostUsedPayment = Object.entries(paymentMethods).sort((a, b) => b[1] - a[1])[0];

                            const analysisHTML = `
                                <h4>Resumo do Período:</h4>
                                <ul class="list-disc pl-5 space-y-1">
                                    <li><strong>Total de Vendas:</strong> ${formatCurrency(totalSales)} em ${numOrders} pedido(s).</li>
                                    <li><strong>Ticket Médio:</strong> ${formatCurrency(avgTicket)} por pedido.</li>
                                    ${bestDay ? `<li><strong>Dia de Maior Movimento:</strong> ${bestDay[0]} com ${formatCurrency(bestDay[1])}.</li>` : ''}
                                    ${mostUsedPayment ? `<li><strong>Forma de Pagamento Mais Usada:</strong> ${mostUsedPayment[0]}.</li>` : ''}
                                </ul>
                                <p class="mt-3 text-xs text-slate-400">*Análise gerada automaticamente com base nos dados disponíveis.</p>
                            `;
                            
                            aiResultContainer.innerHTML = analysisHTML;
                            newGenerateAiBtn.disabled = false;
                        }, 1500);
                    });
                }
            }
        }

        const summaryContainer = c.querySelector('#intelligent-summary') || document.createElement('div');
        summaryContainer.id = 'intelligent-summary';
        summaryContainer.className = 'mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';

        const alertsContainer = c.querySelector('#intelligent-alerts') || document.createElement('div');
        alertsContainer.id = 'intelligent-alerts';
        alertsContainer.className = 'mt-6 space-y-3';

        const mainContent = c.querySelector('.grid');
        if (mainContent && !c.querySelector('#intelligent-summary')) {
            mainContent.parentNode.insertBefore(summaryContainer, mainContent);
            mainContent.parentNode.appendChild(alertsContainer);
        }

        if (!state.db.settings.bonusSystem?.enabled) {
            const bonusCards = c.querySelectorAll('#bonus-hoje-card, #bonus-semana-card, #bonus-mes-card');
            bonusCards.forEach(card => card?.classList.add('hidden'));
        }

        const updateDashboardUI = (sales, allStoreSales) => {
            if (vendasChartInstance) vendasChartInstance.destroy();
            if (pagamentoChartInstance) pagamentoChartInstance.destroy();
            
            if (isManager) {
                const insights = generateIntelligentInsights(sales, allStoreSales);
                summaryContainer.innerHTML = insights.summary.map(insight => `
                    <div class="custom-card p-4 flex items-start gap-3 rounded-lg">
                        <span class="text-xl">${insight.icon}</span>
                        <p class="text-sm text-slate-700 dark:text-slate-300">${insight.text}</p>
                    </div>
                `).join('');

                alertsContainer.innerHTML = insights.alerts.map(alert => `
                     <div class="custom-card p-4 flex items-start gap-3 rounded-lg bg-amber-50 border-l-4 border-amber-400 dark:bg-amber-900/20 dark:border-amber-500">
                        <span class="text-xl">${alert.icon}</span>
                        <div class="flex-1">
                            <p class="text-sm text-amber-800 dark:text-amber-200">${alert.text}</p>
                            ${alert.action ? `<div class="mt-2">${alert.action}</div>` : ''}
                        </div>
                    </div>
                `).join('');
                window.lucide.createIcons();
            } else {
                summaryContainer.innerHTML = '';
                alertsContainer.innerHTML = '';
            }

            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            const dayOfWeek = now.getDay();
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);

            const salesToday = sales.filter(s => s.date.toDate().getTime() >= startOfToday.getTime());
            const salesWeek = sales.filter(s => s.date.toDate().getTime() >= startOfWeek.getTime());
            const salesMonth = sales.filter(s => s.date.toDate().getTime() >= startOfMonth.getTime());

            c.querySelector('#relatorio-vendas-hoje').textContent = formatCurrency(salesToday.reduce((sum, s) => sum + s.total, 0));
            c.querySelector('#relatorio-vendas-semana').textContent = formatCurrency(salesWeek.reduce((sum, s) => sum + s.total, 0));
            c.querySelector('#relatorio-vendas-mes').textContent = formatCurrency(salesMonth.reduce((sum, s) => sum + s.total, 0));
            
            if(state.db.settings.bonusSystem?.enabled){
                 c.querySelector('#relatorio-bonus-dia').textContent = salesToday.reduce((sum, s) => sum + s.bonus, 0);
                 c.querySelector('#relatorio-bonus-semana').textContent = salesWeek.reduce((sum, s) => sum + s.bonus, 0);
                 c.querySelector('#relatorio-bonus-mes').textContent = salesMonth.reduce((sum, s) => sum + s.bonus, 0);
            }
            
            const salesLast7Days = {};
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                d.setDate(d.getDate() - i);
                salesLast7Days[d.toISOString().split('T')[0]] = { label: d.toLocaleDateString('pt-BR', {weekday: 'short'}).slice(0,3), total: 0 };
            }
            sales.forEach(sale => {
                const saleDate = sale.date.toDate();
                const dayKey = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate()).toISOString().split('T')[0];
                if (salesLast7Days[dayKey]) {
                    salesLast7Days[dayKey].total += sale.total;
                }
            });

            const isDarkMode = document.documentElement.classList.contains('dark');
            const gridColor = isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(203, 213, 225, 0.5)';
            const textColor = isDarkMode ? '#cbd5e1' : '#475569';
            
            const vendasCtx = document.getElementById('vendas-semana-chart')?.getContext('2d');
            if(vendasCtx) {
                const gradient = vendasCtx.createLinearGradient(0, 0, 0, vendasCtx.canvas.height);
                gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
                gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
                
                vendasChartInstance = new window.Chart(vendasCtx, {
                    type: 'line',
                    data: { 
                        labels: Object.values(salesLast7Days).map(d => d.label), 
                        datasets: [{ 
                            label: 'Vendas Diárias', 
                            data: Object.values(salesLast7Days).map(d => d.total), 
                            backgroundColor: gradient,
                            borderColor: '#3b82f6',
                            borderWidth: 2,
                            pointBackgroundColor: '#3b82f6',
                            pointRadius: 4,
                            fill: true,
                            tension: 0.4
                        }] 
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } }, x: { grid: { display: false }, ticks: { color: textColor } } } }
                });
            }

            const paymentData = sales.reduce((acc, sale) => {
                (sale.paymentMethods || [{method: sale.paymentMethod, amount: sale.total}]).forEach(p => {
                    acc[p.method] = (acc[p.method] || 0) + p.amount;
                });
                return acc;
            }, {});

            const pagamentosCtx = document.getElementById('pagamento-chart')?.getContext('2d');
            if(pagamentosCtx) {
                pagamentoChartInstance = new window.Chart(pagamentosCtx, {
                    type: 'doughnut',
                    data: { 
                        labels: Object.keys(paymentData), 
                        datasets: [{ 
                            data: Object.values(paymentData), 
                            backgroundColor: ['#3b82f6', '#22c55e', '#ec4899', '#f59e0b'], 
                            borderColor: isDarkMode ? '#0f172a' : '#f1f5f9', 
                            borderWidth: 4 
                        }] 
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: textColor } } } }
                });
            }
        };
        
        const vendedorSelectContainer = c.querySelector('#gerente-relatorios-vendedor-select-container');
        
        let q = query(collection(db, "sales"), where("storeId", "==", state.selectedStore.id));

        state.listeners.relatorios = onSnapshot(q, (snapshot) => {
            let allStoreSales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            allStoreSales.sort((a, b) => b.date.seconds - a.date.seconds);
            
            if (isManager) {
                vendedorSelectContainer.classList.remove('hidden');
                const vendedorSelect = c.querySelector('#relatorios-vendedor-select');
                const vendedores = [...new Set(allStoreSales.map(s => s.vendedor))];
                vendedorSelect.innerHTML = '<option value="total">Relatório Total da Loja</option>';
                vendedores.forEach(name => { vendedorSelect.innerHTML += `<option value="${name}">${name}</option>`; });
                
                const newSelect = vendedorSelect.cloneNode(true);
                vendedorSelect.parentNode.replaceChild(newSelect, vendedorSelect);
                
                newSelect.addEventListener('change', (e) => {
                    const salesToReport = e.target.value === 'total' ? allStoreSales : allStoreSales.filter(s => s.vendedor === e.target.value);
                    updateDashboardUI(salesToReport, allStoreSales);
                });
                
                updateDashboardUI(allStoreSales, allStoreSales);
            } else {
                vendedorSelectContainer.classList.add('hidden');
                const mySales = allStoreSales.filter(s => s.vendedor === state.loggedInUser.name);
                updateDashboardUI(mySales, allStoreSales);
            }
        }, (error) => {
            console.error("Erro ao buscar dados para o dashboard: ", error);
            c.innerHTML = `<div class="text-center p-8 text-red-500"><b>Erro:</b> Não foi possível carregar o dashboard.</div>`;
        });
    }

    function renderConfiguracoes() {
        const c=document.getElementById('configuracoes-view');
        c.querySelector('#config-store-name').value = state.db.settings.storeName;
        c.querySelector('#meta-diaria').value = state.db.settings.goals?.daily || 0;
        c.querySelector('#meta-semanal').value = state.db.settings.goals?.weekly || 0;
        c.querySelector('#meta-mensal').value = state.db.settings.goals?.monthly || 0;
        
        const enableBonusCheckbox = c.querySelector('#enable-bonus');
        const bonusValueContainer = c.querySelector('#bonus-value-container');
        const bonusValueInput = c.querySelector('#bonus-value');

        enableBonusCheckbox.checked = state.db.settings.bonusSystem?.enabled ?? true;
        bonusValueInput.value = state.db.settings.bonusSystem?.value ?? 80;

        if (enableBonusCheckbox.checked) {
            bonusValueContainer.classList.remove('hidden');
        } else {
            bonusValueContainer.classList.add('hidden');
        }
        enableBonusCheckbox.addEventListener('change', () => {
            bonusValueContainer.classList.toggle('hidden', !enableBonusCheckbox.checked);
        });
        
        const exportVendedorSelect = c.querySelector('#export-vendedor-select');
        exportVendedorSelect.innerHTML = '<option value="Todos">Todos os Vendedores</option>';
        const vendedores = state.db.users.filter(u => u.role === 'vendedor' && u.storeId === state.selectedStore.id).map(u => u.name);
        vendedores.forEach(name => {
            exportVendedorSelect.innerHTML += `<option value="${name}">${name}</option>`;
        });
        
        const handleExport = async (startDate, endDate, filename) => {
            const selectedVendedor = exportVendedorSelect.value;
            try {
                let baseConditions = [
                    where("storeId", "==", state.selectedStore.id),
                    where("date", ">=", startDate),
                    where("date", "<=", endDate)
                ];

                const baseQuery = query(collection(db, "sales"), ...baseConditions);
                const salesSnapshot = await getDocs(baseQuery);
                let salesToExport = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                if (selectedVendedor !== 'Todos') {
                    salesToExport = salesToExport.filter(sale => sale.vendedor === selectedVendedor);
                }

                exportToCSV(salesToExport, filename);
            } catch (error) {
                console.error("Erro ao exportar vendas:", error);
                showToast('Erro ao buscar dados para exportação.', 'error');
            }
        };
        
        c.querySelector('#export-today-btn').addEventListener('click', () => {
            const todayStart = new Date(new Date().setHours(0,0,0,0));
            const todayEnd = new Date(new Date().setHours(23,59,59,999));
            const filename = `vendas_dia_${new Date().toISOString().split('T')[0]}_${exportVendedorSelect.value}`;
            handleExport(todayStart, todayEnd, filename);
        });

        c.querySelector('#export-week-btn').addEventListener('click', () => {
            const today = new Date();
            const dayOfWeek = today.getDay();
            const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const weekStart = new Date(new Date(today.setDate(diff)).setHours(0, 0, 0, 0));
            const weekEnd = new Date(new Date(weekStart).setDate(weekStart.getDate() + 6));
            weekEnd.setHours(23,59,59,999);
            const filename = `vendas_semana_${new Date().toISOString().split('T')[0]}_${exportVendedorSelect.value}`;
            handleExport(weekStart, weekEnd, filename);
        });

        c.querySelector('#export-month-btn').addEventListener('click', () => {
            const today = new Date();
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            monthEnd.setHours(23,59,59,999);
            const filename = `vendas_mes_${today.getFullYear()}_${today.getMonth() + 1}_${exportVendedorSelect.value}`;
            handleExport(monthStart, monthEnd, filename);
        });

        c.querySelector('#export-range-btn').addEventListener('click', () => {
            const startDateInput = c.querySelector('#start-date').value;
            const endDateInput = c.querySelector('#end-date').value;
            if (!startDateInput || !endDateInput) {
                showToast('Por favor, selecione data de início e fim.', 'error');
                return;
            }
            const startDate = new Date(startDateInput + 'T00:00:00');
            const endDate = new Date(endDateInput + 'T23:59:59');
            const filename = `vendas_de_${startDateInput}_a_${endDateInput}_${exportVendedorSelect.value}`;
            handleExport(startDate, endDate, filename);
        });

        const updateUsersList=()=>{
            const list=c.querySelector('#users-list');
            list.innerHTML='';
            const usersInStore = state.db.users.filter(u => u.storeId === state.selectedStore.id || u.role === 'superadmin');
            
            if(usersInStore.length === 0){
                list.innerHTML = '<p class="text-slate-500 text-sm text-center">Nenhum usuário cadastrado para esta loja.</p>';
                return;
            }

            usersInStore.forEach(v=>{
                 const roleClass = v.role === 'superadmin'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                    : v.role === 'gerente'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
                const roleText = v.role.charAt(0).toUpperCase() + v.role.slice(1);

                list.innerHTML+=`<li class="flex justify-between items-center bg-slate-100 dark:bg-slate-700 p-2 rounded-md">
                    <div>
                        <span>${v.name}</span>
                        <span class="text-xs ml-2 px-2 py-0.5 rounded-full font-medium ${roleClass}">${roleText}</span>
                    </div>
                    <button data-userid="${v.id}" data-username="${v.name}" class="remove-user-btn text-red-500 hover:text-red-700 ${v.name === state.loggedInUser.name || v.role === 'superadmin' ? 'hidden' : ''}">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </li>`;
            });
            window.lucide.createIcons();
        };
        
        updateUsersList();

        c.querySelector('#add-user-form').addEventListener('submit', async e => {
            e.preventDefault();
            const n = c.querySelector('#user-name').value.trim();
            const p = c.querySelector('#user-password').value;
            const isManager = c.querySelector('#create-as-manager').checked;
            const role = isManager ? 'gerente' : 'vendedor';

            if (!n || !p) {
                showToast('Nome e senha são obrigatórios.', 'error');
                return;
            }
            if (state.db.users.some(u => u.name.toLowerCase() === n.toLowerCase())) {
                showToast('Nome de usuário já existe.', 'error');
                return;
            }

            const email = `${n.toLowerCase().replace(/\s+/g, '')}@pdv-app.com`;

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, p);
                const user = userCredential.user;

                await setDoc(doc(db, "users", user.uid), {
                    name: n,
                    role: role,
                    storeId: state.selectedStore.id
                });

                showToast('Usuário cadastrado com sucesso!', 'success');
                e.target.reset();
                updateUsersList();
            } catch (error) {
                console.error("Erro ao criar usuário:", error);
                if (error.code === 'auth/email-already-in-use') {
                    showToast('Este nome de usuário já está em uso.', 'error');
                } else if (error.code === 'auth/weak-password') {
                    showToast('A senha deve ter no mínimo 6 caracteres.', 'error');
                } else {
                    showToast('Erro ao cadastrar usuário.', 'error');
                }
            }
        });

        c.querySelector('#users-list').addEventListener('click', e => {
            const removeBtn = e.target.closest('.remove-user-btn');
            if (removeBtn) {
                const { userid, username } = removeBtn.dataset;
                showConfirmModal(`Tem certeza que deseja remover o usuário "${username}"?`, async () => {
                   try {
                       await deleteDoc(doc(db, "users", userid));
                       showToast(`Usuário "${username}" removido.`, 'success');
                   } catch (error) { showToast('Erro ao remover usuário.', 'error'); }
                });
            }
        });

        c.querySelector('#save-settings-button').addEventListener('click', async ()=> {
            const newStoreName = c.querySelector('#config-store-name').value;
            try {
                await setDoc(doc(db, "settings", state.selectedStore.id), { storeName: newStoreName }, { merge: true });
                await setDoc(doc(db, "stores", state.selectedStore.id), { name: newStoreName }, { merge: true });
                state.db.settings.storeName = newStoreName;
                state.selectedStore.name = newStoreName;
                document.getElementById('store-name-sidebar').textContent = newStoreName;
                showToast('Configurações da loja salvas!', 'success');
            } catch (error) { showToast('Erro ao salvar configurações da loja.', 'error'); }
        });

        c.querySelector('#save-goals-button').addEventListener('click', async () => {
            const newGoals = {
                daily: parseFloat(c.querySelector('#meta-diaria').value) || 0,
                weekly: parseFloat(c.querySelector('#meta-semanal').value) || 0,
                monthly: parseFloat(c.querySelector('#meta-mensal').value) || 0,
            };
             const newBonusSystem = {
                 enabled: c.querySelector('#enable-bonus').checked,
                 value: parseFloat(c.querySelector('#bonus-value').value) || 80,
            };

            try {
                await setDoc(doc(db, "settings", state.selectedStore.id), {
                    goals: newGoals,
                    bonusSystem: newBonusSystem
                }, { merge: true });
                state.db.settings.goals = newGoals;
                state.db.settings.bonusSystem = newBonusSystem;
                showToast('Metas e bônus salvos com sucesso!', 'success');
            } catch(error) {
                showToast('Erro ao salvar metas e bônus.', 'error');
            }
        });
        
         c.querySelector('#delete-all-sales-button').addEventListener('click', async () => {
              showConfirmModal(`TEM CERTEZA? Esta ação removerá PERMANENTEMENTE todas as vendas da loja "${state.selectedStore.name}".`, async () => {
                  try {
                      const q = query(collection(db, "sales"), where("storeId", "==", state.selectedStore.id));
                      const salesSnapshot = await getDocs(q);
                      if (salesSnapshot.empty) { showToast('Nenhuma venda para apagar.', 'success'); return; }
                      const batch = writeBatch(db);
                      salesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                      await batch.commit();
                      showToast(`Todas as vendas da loja "${state.selectedStore.name}" foram zeradas!`, 'success');
                  } catch (error) { showToast('Ocorreu um erro ao zerar as vendas.', 'error'); }
              });
          });
        
        const manageStoresSection = c.querySelector('#manage-stores-section');
        if (state.loggedInUser.role === 'superadmin') {
            manageStoresSection.classList.remove('hidden');

            const addStoreForm = c.querySelector('#add-store-form');
            const storesListEl = c.querySelector('#stores-management-list');

            addStoreForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newStoreNameInput = c.querySelector('#new-store-name');
                const newStoreName = newStoreNameInput.value.trim();
                if (!newStoreName) { return showToast('O nome da loja não pode ser vazio.', 'error'); }
                if (state.db.stores.some(store => store.name.toLowerCase() === newStoreName.toLowerCase())) {
                    return showToast('Uma loja com este nome já existe.', 'error');
                }
                try {
                    const storeRef = await addDoc(collection(db, "stores"), { name: newStoreName });
                    await setDoc(doc(db, "settings", storeRef.id), {
                        storeName: newStoreName,
                        goals: { daily: 150, weekly: 1000, monthly: 4000 },
                        bonusSystem: { enabled: true, value: 80 }
                    });
                    showToast(`Loja "${newStoreName}" criada!`, 'success');
                    newStoreNameInput.value = '';
                } catch (error) { console.error("Erro ao criar loja:", error); showToast('Não foi possível criar a loja.', 'error'); }
            });
            
            const renderStoresList = () => {
                storesListEl.innerHTML = '';
                state.db.stores.forEach(store => {
                    const li = document.createElement('li');
                    li.className = 'flex justify-between items-center bg-slate-100 dark:bg-slate-700 p-2 rounded-md';
                    li.innerHTML = `<span>${store.name}</span>
                        <button data-store-id="${store.id}" data-store-name="${store.name}" class="remove-store-btn text-red-500 hover:text-red-700">
                            <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                        </button>`;
                    storesListEl.appendChild(li);
                });
                window.lucide.createIcons();
            };

            renderStoresList();

            storesListEl.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.remove-store-btn');
                if (removeBtn) {
                    if (state.db.stores.length <= 1) { return showToast('Não é possível excluir a última loja.', 'error'); }
                    const { storeId, storeName } = removeBtn.dataset;
                    showConfirmModal(`Apagar a loja "${storeName}"? TODOS os dados (vendas, usuários) desta loja serão PERDIDOS.`, async () => {
                        try {
                            const batch = writeBatch(db);
                            const salesQuery = query(collection(db, "sales"), where("storeId", "==", storeId));
                            const usersQuery = query(collection(db, "users"), where("storeId", "==", storeId));
                            const [salesSnapshot, usersSnapshot] = await Promise.all([getDocs(salesQuery), getDocs(usersQuery)]);
                            
                            salesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                            usersSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                            batch.delete(doc(db, "settings", storeId));
                            batch.delete(doc(db, "stores", storeId));
                            
                            await batch.commit();
                            showToast(`Loja "${storeName}" excluída.`, 'success');
                        } catch (error) { console.error("Erro ao deletar loja:", error); showToast('Erro ao deletar a loja.', 'error'); }
                    });
                }
            });
        } else {
            manageStoresSection.classList.add('hidden');
        }

        const wheelConfigContainer = c.querySelector('#bonus-wheel-config-container');
        const enableWheelCheckbox = c.querySelector('#enable-bonus-wheel');
        let prizes = state.db.settings.bonusWheel?.prizes ? [...state.db.settings.bonusWheel.prizes] : [];
        
        enableWheelCheckbox.checked = state.db.settings.bonusWheel?.enabled ?? false;
        wheelConfigContainer.classList.toggle('hidden', !enableWheelCheckbox.checked);

        const minValueInput = c.querySelector('#bonus-wheel-min-value');
        minValueInput.value = state.db.settings.bonusWheel?.minValue ?? 0;

        enableWheelCheckbox.addEventListener('change', () => {
            wheelConfigContainer.classList.toggle('hidden', !enableWheelCheckbox.checked);
        });

        const renderPrizes = () => {
            const list = c.querySelector('#prizes-list');
            const totalProbEl = c.querySelector('#total-probability');
            list.innerHTML = '';
            let totalProb = 0;
            prizes.forEach((prize, index) => {
                totalProb += prize.probability;
                list.innerHTML += `
                    <li class="flex justify-between items-center bg-slate-100 dark:bg-slate-700 p-2 rounded-md text-sm">
                        <span>${prize.name} <span class="text-xs text-slate-500">(${prize.probability}%)</span></span>
                        <button data-index="${index}" class="remove-prize-btn text-red-500 hover:text-red-700">
                            <i data-lucide="x" class="w-4 h-4 pointer-events-none"></i>
                        </button>
                    </li>
                `;
            });
            totalProbEl.textContent = `${totalProb}%`;
            totalProbEl.classList.toggle('text-red-500', totalProb !== 100);
            totalProbEl.classList.toggle('text-green-500', totalProb === 100);
            window.lucide.createIcons();
        };

        c.querySelector('#add-prize-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = c.querySelector('#prize-name').value.trim();
            const probability = parseInt(c.querySelector('#prize-probability').value);
            if (name && probability > 0) {
                prizes.push({ name, probability });
                renderPrizes();
                e.target.reset();
            }
        });

        c.querySelector('#prizes-list').addEventListener('click', (e) => {
            if (e.target.closest('.remove-prize-btn')) {
                const index = e.target.closest('.remove-prize-btn').dataset.index;
                prizes.splice(index, 1);
                renderPrizes();
            }
        });

        c.querySelector('#save-wheel-button').addEventListener('click', async () => {
            const totalProb = prizes.reduce((sum, p) => sum + p.probability, 0);
            if (prizes.length > 0 && totalProb !== 100) {
                return showToast('A soma das probabilidades dos prêmios deve ser exatamente 100%.', 'error');
            }
            
            const newWheelSettings = {
                enabled: enableWheelCheckbox.checked,
                prizes: prizes,
                minValue: parseFloat(minValueInput.value) || 0
            };

            try {
                await setDoc(doc(db, "settings", state.selectedStore.id), { bonusWheel: newWheelSettings }, { merge: true });
                state.db.settings.bonusWheel = newWheelSettings;
                showToast('Configurações da roleta salvas!', 'success');
            } catch (error) {
                showToast('Erro ao salvar configurações da roleta.', 'error');
                console.error("Erro ao salvar roleta:", error);
            }
        });

        renderPrizes();
    }

    function generateIntelligentInsights(salesData, allStoreSales) {
        const summary = [];
        const alerts = [];

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
        const weekStart = new Date(now.getFullYear(), now.getMonth(), diff);
        weekStart.setHours(0,0,0,0);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const salesThisWeek = allStoreSales.filter(s => s.date.toDate() >= weekStart);
        const totalThisWeek = salesThisWeek.reduce((sum, s) => sum + s.total, 0);
        const daysPassedInWeek = now.getDay() === 0 ? 7 : now.getDay();
        const avgDailyThisWeek = totalThisWeek > 0 ? totalThisWeek / daysPassedInWeek : 0;

        const salesThisMonth = allStoreSales.filter(s => s.date.toDate() >= monthStart);
        const totalThisMonth = salesThisMonth.reduce((sum, s) => sum + s.total, 0);

        summary.push({
            icon: '📊',
            text: `Total vendido na semana: <strong>${formatCurrency(totalThisWeek)}</strong> (${formatCurrency(avgDailyThisWeek)}/dia em média).`
        });

        const sellerCount = state.db.users.filter(u => u.storeId === state.selectedStore.id && u.role === 'vendedor').length || 1;
        const individualMonthlyGoal = state.db.settings.goals?.monthly || 0;
        const monthlyGoal = individualMonthlyGoal * sellerCount;

        if (monthlyGoal > 0) {
            const remainingForGoal = monthlyGoal - totalThisMonth;
            if (remainingForGoal > 0) {
                summary.push({
                    icon: '🎯',
                    text: `Meta mensal da equipe: faltam <strong>${formatCurrency(remainingForGoal)}</strong> para atingir ${formatCurrency(monthlyGoal)}.`
                });
            } else {
                 summary.push({
                    icon: '✅',
                    text: `Meta mensal da equipe de ${formatCurrency(monthlyGoal)} batida! Total de <strong>${formatCurrency(totalThisMonth)}</strong>.`
                });
            }
        }
        
        const salesBySellerThisWeek = salesThisWeek.reduce((acc, sale) => {
            acc[sale.vendedor] = (acc[sale.vendedor] || 0) + sale.total;
            return acc;
        }, {});
        const rankedSellersThisWeek = Object.entries(salesBySellerThisWeek).sort((a, b) => b[1] - a[1]);
        if (rankedSellersThisWeek.length > 0) {
            const [topSellerName, topSellerTotal] = rankedSellersThisWeek[0];
            summary.push({
                icon: '🏆',
                text: `Melhor vendedor da semana até agora: <strong>${topSellerName}</strong>, com ${formatCurrency(topSellerTotal)}.`
            });
        }

        const salesToday = allStoreSales.filter(s => s.date.toDate() >= todayStart);
        const totalToday = salesToday.reduce((sum, s) => sum + s.total, 0);
        
        if (totalToday === 0) {
            alerts.push({
                icon: '🚀',
                text: 'Hoje ainda não teve vendas — uma boa oportunidade para incentivar sua equipe a oferecer promoções!'
            });
        } else {
             alerts.push({
                icon: '💰',
                text: `Total de vendas hoje: <strong>${formatCurrency(totalToday)}</strong> em ${salesToday.length} venda(s).`,
                action: `<button class="share-daily-report-btn text-sm bg-green-500 text-white py-1 px-3 rounded-md hover:bg-green-600 flex items-center gap-2"><i data-lucide="send" class="w-4 h-4"></i>Enviar Resumo</button>`
            });
        }

        const allSellers = state.db.users.filter(u => u.role === 'vendedor' && u.storeId === state.selectedStore.id);
        const sellersWithSalesToday = new Set(salesToday.map(s => s.vendedor));
        const sellersWithoutSalesToday = allSellers.filter(seller => !sellersWithSalesToday.has(seller.name));

        if (sellersWithoutSalesToday.length > 0 && sellersWithSalesToday.size > 0) {
            alerts.push({
                icon: '🔥',
                text: `Atenção: <strong>${sellersWithoutSalesToday.map(u=>u.name).join(', ')}</strong> está(ão) zerado(s) hoje. Um incentivo pode ajudar!`
            });
        }

        if (salesThisWeek.length > 0) {
            const ticketMedioThisWeek = totalThisWeek / salesThisWeek.length;
            const proposedIncrease = 5;
            const potentialNewTotal = (ticketMedioThisWeek + proposedIncrease) * salesThisWeek.length;
            const percentageIncrease = totalThisWeek > 0 ? ((potentialNewTotal - totalThisWeek) / totalThisWeek) * 100 : 0;

            alerts.push({
                icon: '💡',
                text: `O ticket médio da semana é <strong>${formatCurrency(ticketMedioThisWeek)}</strong>. Se aumentar em apenas ${formatCurrency(proposedIncrease)} por venda, o faturamento subiria <strong>${percentageIncrease.toFixed(0)}%</strong>.`
            });
        }

        return { summary, alerts };
    }
 // ====================================================================================================
    // NOVA FUNÇÃO PARA A TELA FINANCEIRA
    // ====================================================================================================
    function renderFinanceiro() {
        const view = document.getElementById('financeiro-view');
        const monthPicker = view.querySelector('#financial-month-picker');
        const summaryContainer = view.querySelector('#financial-summary');
        const expensesListContainer = view.querySelector('#financial-expenses-list');
        const projectionContainer = view.querySelector('#financial-projection');

        const updateFinancialReport = (year, month) => {
            const selectedMonthStr = `${year}-${String(month).padStart(2, '0')}`;
            
            const salesInMonth = state.db.sales.filter(s => s.saleMonth === selectedMonthStr);
            const expensesInMonth = state.db.expenses.filter(e => e.month === selectedMonthStr);

            const grossRevenue = salesInMonth.reduce((sum, sale) => sum + sale.total, 0);
            const cogs = salesInMonth.flatMap(s => s.items).reduce((sum, item) => sum + (item.cost || 0), 0);
            const grossProfit = grossRevenue - cogs;
            const totalExpenses = expensesInMonth.reduce((sum, exp) => sum + exp.value, 0);
            const netProfit = grossProfit - totalExpenses;

            summaryContainer.innerHTML = `
                <div class="custom-card p-4"><p class="text-sm text-slate-500">Receita Bruta</p><p class="text-2xl font-bold text-green-500">${formatCurrency(grossRevenue)}</p></div>
                <div class="custom-card p-4"><p class="text-sm text-slate-500">Custo dos Produtos</p><p class="text-2xl font-bold text-amber-500">${formatCurrency(cogs)}</p></div>
                <div class="custom-card p-4"><p class="text-sm text-slate-500">Lucro Bruto</p><p class="text-2xl font-bold text-sky-500">${formatCurrency(grossProfit)}</p></div>
                <div class="custom-card p-4"><p class="text-sm text-slate-500">Despesas Totais</p><p class="text-2xl font-bold text-red-500">${formatCurrency(totalExpenses)}</p></div>
                <div class="custom-card p-4 bg-slate-800 text-white"><p class="text-sm text-slate-300">Lucro Líquido</p><p class="text-3xl font-bold">${formatCurrency(netProfit)}</p></div>
            `;
            
            if (expensesInMonth.length > 0) {
                expensesListContainer.innerHTML = '<ul class="space-y-2">' + expensesInMonth.map(exp => `
                    <li class="flex justify-between items-center text-sm p-2 bg-slate-200/50 dark:bg-slate-800/50 rounded-md">
                        <div>
                            <span class="font-medium">${exp.description}</span>
                            <span class="text-xs ml-2 px-2 py-0.5 rounded-full ${exp.type === 'Fixo' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}">${exp.type}</span>
                        </div>
                        <span class="font-semibold">${formatCurrency(exp.value)}</span>
                    </li>
                `).join('') + '</ul>';
            } else {
                expensesListContainer.innerHTML = '<p class="text-center p-4 text-slate-500">Nenhuma despesa registrada para este mês.</p>';
            }

            projectionContainer.innerHTML = '';
            const now = new Date();
            if (now.getFullYear() === year && now.getMonth() + 1 === month) {
                const daysInMonth = new Date(year, month, 0).getDate();
                const daysPassed = now.getDate();
                const projectedProfit = (netProfit / daysPassed) * daysInMonth;
                projectionContainer.innerHTML = `<p class="text-sm text-slate-500">Com base nos ${daysPassed} dias do mês, a projeção de lucro líquido é:</p><p class="text-2xl font-bold text-brand-primary">${formatCurrency(projectedProfit)}</p>`;
            } else {
                projectionContainer.innerHTML = `<p class="text-center p-4 text-slate-500">Projeções estão disponíveis apenas para o mês corrente.</p>`;
            }
        };

        monthPicker.addEventListener('change', () => {
            const [year, month] = monthPicker.value.split('-').map(Number);
            updateFinancialReport(year, month);
        });

        // Define o valor inicial para o mês atual e carrega o relatório
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        monthPicker.value = currentMonthStr;
        updateFinancialReport(now.getFullYear(), now.getMonth() + 1);
    }

    const init = () => {
        const theme = localStorage.getItem('theme') || 'dark';
        applyTheme(theme);
        const themeToggleHandler = () => {
            const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
            if (['relatorios', 'metas', 'ranking'].includes(state.currentView) && document.getElementById(`${state.currentView}-view`).classList.contains('active')) {
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