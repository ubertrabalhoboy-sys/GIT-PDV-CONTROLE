// js/main.js

import { state, uiState, resetState } from './state.js';
import { loginUser, logoutUser, createAuthUser } from './services/auth.js';
import * as dataService from './services/dataService.js';
import { setupThemeToggle } from './utils/theme.js';
import { formatCurrency, formatDate } from './utils/formatters.js';
import { showToast, showConfirmModal, showMobileMenu, exportToCSV } from './utils/domUtils.js';

// Importar todas as funções de renderização das views
import { loadInitialData, handleStoreSelection, handleUserSelection } from './views/login.js';
import { renderCaixa } from './views/caixa.js';
import { renderClientes, handleClientSearch, prepareEditClient, getClientFormData, renderClientDetailsModal, resetClientForm } from './views/clientes.js';
import { renderConfiguracoes, renderPrizes } from './views/configuracoes.js';
import { renderDashboard } from './views/dashboard.js';
import { renderMetas } from './views/metas.js';
import { renderPedidos } from './views/pedidos.js';
import { renderProdutos } from './views/produtos.js';
import { renderRanking } from './views/ranking.js';
// (Importar outras funções das views se elas precisarem ser chamadas diretamente daqui)

// Função principal de inicialização
function init() {
    setupThemeToggle(() => {
        if (['relatorios', 'ranking'].includes(state.currentView)) {
            switchView(state.currentView);
        }
    });
    setupEventListeners();
    loadInitialData();
}

// --- Gerenciamento de Views ---
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active', 'fade-in'));
    const activeView = document.getElementById(`${viewId}-view`);
    if (activeView) {
        state.currentView = viewId;
        activeView.classList.add('active', 'fade-in');

        const link = document.querySelector(`#sidebar a[data-view="${viewId}"]`);
        if (link) {
            document.getElementById('current-view-title').textContent = link.querySelector('span').textContent;
            document.querySelectorAll('#sidebar ul li a').forEach(l => l.classList.remove('bg-slate-700', 'text-white'));
            link.classList.add('bg-slate-700', 'text-white');
        }
        renderViewContent(viewId);
    }
    showMobileMenu(false);
}

function renderViewContent(viewId) {
    const viewContainer = document.getElementById(`${viewId}-view`);
    const template = document.getElementById(`${viewId}-template`);
    if (!template) {
        console.error(`Template para a view "${viewId}" não encontrado.`);
        return;
    }
    viewContainer.innerHTML = template.innerHTML;

    if (['pedidos', 'produtos', 'clientes'].includes(viewId)) {
        const table = viewContainer.querySelector('table');
        if (table && !table.parentElement.classList.contains('table-responsive-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'overflow-x-auto table-responsive-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    }

    const renderFunctions = {
        caixa: renderCaixa,
        clientes: renderClientes,
        configuracoes: renderConfiguracoes,
        relatorios: renderDashboard,
        metas: renderMetas,
        pedidos: renderPedidos,
        produtos: renderProdutos,
        ranking: renderRanking,
    };

    if (renderFunctions[viewId]) {
        renderFunctions[viewId]();
    }
    window.lucide.createIcons();
}

// --- Listeners do Firestore ---
function setupFirestoreListeners() {
    // Listener para Lojas (apenas para superadmin)
    if (state.loggedInUser.role === 'superadmin') {
        if (state.listeners.stores) state.listeners.stores();
        state.listeners.stores = dataService.listenToCollection('stores', (snapshot) => {
            state.db.stores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Atualiza o seletor de lojas
            const select = document.getElementById('store-switcher-select');
            if (select) {
                const currentStoreId = state.selectedStore?.id;
                select.innerHTML = state.db.stores.map(s => `<option value="${s.id}" ${s.id === currentStoreId ? 'selected' : ''}>${s.name}</option>`).join('');
            }
        });
    }

    // Listener para Usuários
    if (state.listeners.users) state.listeners.users();
    state.listeners.users = dataService.listenToCollection('users', (snapshot) => {
        state.db.users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (state.currentView === 'configuracoes') {
            renderConfiguracoes();
        }
    });

    // Listeners específicos da loja selecionada
    const storeId = state.selectedStore.id;

    // Listener para Produtos
    if (state.listeners.products) state.listeners.products();
    state.listeners.products = dataService.listenToCollection('products', (snapshot) => {
        state.db.products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (state.currentView === 'produtos') {
            renderProdutos();
        }
    }, [where("storeId", "==", storeId)]);

    // Listener para Clientes
    if (state.listeners.clients) state.listeners.clients();
    state.listeners.clients = dataService.listenToCollection('clients', (snapshot) => {
        state.db.clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (state.currentView === 'clientes') {
            renderClientes();
        }
    }, [where("storeId", "==", storeId)]);

    // Listener para Vendas (pode ser complexo dependendo dos filtros)
    // O ideal é recriar este listener quando os filtros mudam na tela de Pedidos/Dashboard
    setupSalesListener();
}

function setupSalesListener(filters = {}) {
    if (state.listeners.sales) state.listeners.sales();

    let conditions = [where("storeId", "==", state.selectedStore.id)];

    // Adicionar condições de filtro aqui
    if (filters.vendedor && filters.vendedor !== 'Todos') {
        conditions.push(where("vendedor", "==", filters.vendedor));
    } else if (state.loggedInUser.role === 'vendedor') {
        conditions.push(where("vendedor", "==", state.loggedInUser.name));
    }
    
    // ... outros filtros de data, pagamento, etc.

    state.listeners.sales = dataService.listenToCollection('sales', (snapshot) => {
        state.db.sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Re-renderiza a view atual se ela depender de vendas
        if (['pedidos', 'relatorios', 'metas', 'ranking'].includes(state.currentView)) {
            renderViewContent(state.currentView);
        }
    }, conditions);
}

// --- Lógica Principal da Aplicação ---
async function handleLogout() {
    await logoutUser();
    resetState();
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    loadInitialData();
}

function initializeAppUI() {
    const user = state.loggedInUser;
    const store = state.selectedStore;

    document.getElementById('store-name-sidebar').textContent = store.name;
    document.getElementById('username-sidebar').textContent = user.name;
    document.getElementById('user-icon').textContent = user.name.charAt(0).toUpperCase();

    // Configura os menus baseados na role do usuário
    const vM = document.getElementById('vendedor-menu');
    const gM = document.getElementById('gerente-menu');
    const createMenuItem = (v, i, t) => `<li><a href="#" data-view="${v}" class="flex items-center p-2 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white group transition-colors"><i data-lucide="${i}" class="w-5 h-5"></i><span class="ml-3">${t}</span></a></li>`;
    const createLogoutItem = () => `<li class="pt-2 mt-2 border-t border-slate-700"><button data-action="logout" class="w-full flex items-center p-2 text-red-400 rounded-lg hover:bg-red-500 hover:text-white group transition-colors"><i data-lucide="log-out" class="w-5 h-5"></i><span class="ml-3">Sair</span></button></li>`;

    vM.innerHTML = ''; gM.innerHTML = '';
    if (user.role === 'vendedor') {
        vM.innerHTML = createMenuItem('caixa', 'shopping-basket', 'Caixa') + createMenuItem('pedidos', 'list-ordered', 'Pedidos') + createMenuItem('metas', 'target', 'Metas') + createMenuItem('ranking', 'trophy', 'Ranking') + createMenuItem('relatorios', 'layout-dashboard', 'Dashboard') + createLogoutItem();
        vM.classList.remove('hidden'); gM.classList.add('hidden');
        switchView('caixa');
    } else { // Gerente ou Superadmin
        gM.innerHTML = createMenuItem('relatorios', 'layout-dashboard', 'Dashboard') + createMenuItem('pedidos', 'list-ordered', 'Pedidos') + createMenuItem('clientes', 'users', 'Clientes') + createMenuItem('produtos', 'package', 'Produtos') + createMenuItem('ranking', 'trophy', 'Ranking') + createMenuItem('configuracoes', 'settings', 'Configurações') + createLogoutItem();
        gM.classList.remove('hidden'); vM.classList.add('hidden');
        switchView('relatorios');
    }

    if (user.role === 'superadmin') {
        document.getElementById('store-switcher-container').classList.remove('hidden');
    } else {
        document.getElementById('store-switcher-container').classList.add('hidden');
    }

    setupFirestoreListeners();
}

// --- Event Listeners Globais e Delegados ---
function setupEventListeners() {
    // Sidebar e Menu Mobile
    document.getElementById('sidebar').addEventListener('click', e => {
        const link = e.target.closest('a[data-view]');
        const logoutBtn = e.target.closest('button[data-action="logout"]');
        if (link) { e.preventDefault(); switchView(link.dataset.view); }
        if (logoutBtn) { handleLogout(); }
    });
    document.getElementById('mobile-menu-button').addEventListener('click', () => showMobileMenu(true));
    document.getElementById('sidebar-overlay').addEventListener('click', () => showMobileMenu(false));

    // Fluxo de Login
    document.getElementById('store-list').addEventListener('click', e => {
        const storeButton = e.target.closest('button');
        if (storeButton) handleStoreSelection(storeButton);
    });
    document.getElementById('user-selection-view').addEventListener('click', e => {
        const userButton = e.target.closest('button[data-username]');
        if (userButton) handleUserSelection(userButton);
    });
    document.getElementById('back-to-stores').addEventListener('click', () => {
        document.getElementById('user-selection-view').classList.add('hidden');
        document.getElementById('store-selection-view').classList.remove('hidden');
        state.selectedStore = null;
        state.db.users = [];
    });
     document.getElementById('back-to-users').addEventListener('click', () => {
        uiState.selectedUserForLogin = null;
        document.getElementById('password-view').classList.add('hidden');
        document.getElementById('user-selection-view').classList.remove('hidden');
        document.getElementById('login-error').textContent = '';
    });
    document.getElementById('password-form').addEventListener('submit', async e => {
        e.preventDefault();
        const user = state.db.users.find(u => u.name.toLowerCase() === uiState.selectedUserForLogin.toLowerCase());
        const passwordInput = document.getElementById('password');
        if (!user) {
            showToast('Usuário não encontrado.', 'error');
            return;
        }
        const email = `${user.name.toLowerCase().replace(/\s+/g, '')}@pdv-app.com`;

        try {
            await loginUser(email, passwordInput.value);
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
            document.getElementById('login-error').textContent = 'Senha inválida.';
            const passwordView = document.getElementById('password-view');
            passwordView.classList.add('animate-shake');
            setTimeout(() => passwordView.classList.remove('animate-shake'), 500);
        }
    });

    // Seletor de Lojas (Superadmin)
    document.getElementById('store-switcher-select').addEventListener('change', async (e) => {
        const newStoreId = e.target.value;
        state.selectedStore = state.db.stores.find(s => s.id === newStoreId);
        
        const settingsSnap = await dataService.getSettings(newStoreId);
        if (settingsSnap.exists()) {
            state.db.settings = { ...state.db.settings, ...settingsSnap.data() };
        }
        
        document.getElementById('store-name-sidebar').textContent = state.selectedStore.name;
        setupFirestoreListeners(); // Reconfigura os listeners para a nova loja
        switchView(state.currentView); // Recarrega a view atual com os dados da nova loja
    });
    
    // (Outros listeners delegados para cada view seriam adicionados aqui...)
    // Exemplo: Clientes
    const clientesView = document.getElementById('clientes-view');
    clientesView.addEventListener('submit', async e => {
        if (e.target.id === 'add-client-form') {
            e.preventDefault();
            const { id, data } = getClientFormData(e.target);
            try {
                if (id) {
                    await dataService.saveDocument('clients', id, data);
                    showToast('Cliente atualizado com sucesso!', 'success');
                } else {
                    await dataService.addDocument('clients', data);
                    showToast('Cliente adicionado com sucesso!', 'success');
                }
                resetClientForm();
            } catch (error) {
                showToast('Erro ao salvar cliente.', 'error');
            }
        }
    });
    clientesView.addEventListener('click', async e => {
        const btn = e.target.closest('button[data-client-id]');
        if (!btn) return;

        const clientId = btn.dataset.clientId;
        const client = state.db.clients.find(c => c.id === clientId);

        if (btn.classList.contains('edit-client-btn')) {
            prepareEditClient(client);
        }
        if (btn.classList.contains('remove-client-btn')) {
            showConfirmModal('Tem certeza?', async () => {
                await dataService.deleteDocument('clients', clientId);
                showToast('Cliente removido.');
            });
        }
        if (btn.classList.contains('view-client-btn')) {
            const salesSnapshot = await dataService.getDocs(query(collection(db, "sales"), where("clientId", "==", clientId)));
            const clientSales = salesSnapshot.docs.map(doc => doc.data());
            renderClientDetailsModal(client, clientSales);
        }
    });
    clientesView.addEventListener('input', e => {
        if (e.target.id === 'client-search') {
            handleClientSearch(e.target.value.toLowerCase());
        }
    });
}


document.addEventListener('DOMContentLoaded', init);