// js/main.js (VERSÃO CORRIGIDA E MELHORADA)

import { state, uiState, resetState } from './state.js';
// CORREÇÃO: Removido o prefixo 'js/' dos caminhos de importação.
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

// --- Função principal de inicialização ---
function init() {
    setupThemeToggle(() => {
        if (['relatorios', 'ranking'].includes(state.currentView)) {
            renderViewContent(state.currentView);
        }
    });
    setupEventListeners();
    loadInitialData();
    window.lucide.createIcons();
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

// --- Lógica Principal da Aplicação ---
async function handleLogout() {
    await logoutUser();
    resetState();
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('store-switcher-container').classList.add('hidden');
    loadInitialData();
}

function initializeAppUI() {
    const user = state.loggedInUser;
    const store = state.selectedStore;

    document.getElementById('store-name-sidebar').textContent = store.name;
    document.getElementById('username-sidebar').textContent = user.name;
    document.getElementById('user-icon').textContent = user.name.charAt(0).toUpperCase();

    const vM = document.getElementById('vendedor-menu');
    const gM = document.getElementById('gerente-menu');
    const createMenuItem = (v, i, t) => `<li><a href="#" data-view="${v}" class="flex items-center p-2 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white group transition-colors"><i data-lucide="${i}" class="w-5 h-5"></i><span class="ml-3">${t}</span></a></li>`;
    const createLogoutItem = () => `<li class="pt-2 mt-2 border-t border-slate-700"><button data-action="logout" class="w-full flex items-center p-2 text-red-400 rounded-lg hover:bg-red-500 hover:text-white group transition-colors"><i data-lucide="log-out" class="w-5 h-5"></i><span class="ml-3">Sair</span></button></li>`;

    vM.innerHTML = ''; gM.innerHTML = '';
    if (user.role === 'vendedor') {
        vM.innerHTML = createMenuItem('caixa', 'shopping-basket', 'Caixa') + createMenuItem('pedidos', 'list-ordered', 'Pedidos') + createMenuItem('metas', 'target', 'Metas') + createMenuItem('ranking', 'trophy', 'Ranking') + createMenuItem('relatorios', 'layout-dashboard', 'Dashboard') + createLogoutItem();
        vM.classList.remove('hidden'); gM.classList.add('hidden');
        switchView('caixa');
    } else {
        gM.innerHTML = createMenuItem('relatorios', 'layout-dashboard', 'Dashboard') + createMenuItem('pedidos', 'list-ordered', 'Pedidos') + createMenuItem('clientes', 'users', 'Clientes') + createMenuItem('produtos', 'package', 'Produtos') + createMenuItem('ranking', 'trophy', 'Ranking') + createMenuItem('configuracoes', 'settings', 'Configurações') + createLogoutItem();
        gM.classList.remove('hidden'); vM.classList.add('hidden');
        switchView('relatorios');
    }

    if (user.role === 'superadmin') {
        document.getElementById('store-switcher-container').classList.remove('hidden');
    } else {
        document.getElementById('store-switcher-container').classList.add('hidden');
    }
    
    // setupFirestoreListeners();
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

    // --- Fluxo de Login ---
    document.getElementById('store-list').addEventListener('click', e => {
        const storeButton = e.target.closest('button');
        if (storeButton) handleStoreSelection(storeButton);
    });
    document.getElementById('user-selection-view').addEventListener('click', e => {
        const userButton = e.target.closest('button[data-username]');
        if (userButton) handleUserSelection(userButton);
    });
     document.getElementById('back-to-users').addEventListener('click', () => {
        uiState.selectedUserForLogin = null;
        document.getElementById('password-view').classList.add('hidden');
        document.getElementById('user-selection-view').classList.remove('hidden');
        document.getElementById('login-error').textContent = '';
    });
    document.getElementById('password-form').addEventListener('submit', async e => {
        e.preventDefault(); // <-- CORREÇÃO ESSENCIAL
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
    
    // --- Delegação de eventos para as VIEWS (escuta no #app) ---
    const appContainer = document.getElementById('app');

    appContainer.addEventListener('submit', async e => {
        e.preventDefault(); // <-- CORREÇÃO GLOBAL PARA TODOS OS FORMULÁRIOS

        // Formulário de adicionar/editar cliente
        if (e.target.id === 'add-client-form') {
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
            } catch (error) { showToast('Erro ao salvar cliente.', 'error'); }
        }
        
        // Formulário de adicionar produto
        else if (e.target.id === 'add-product-form') {
            const form = e.target;
            const name = form.querySelector('#product-name').value;
            const price = parseFloat(form.querySelector('#product-price').value);
            const quantity = parseInt(form.querySelector('#product-quantity').value);

            if (!name || isNaN(price) || isNaN(quantity)) {
                return showToast('Preencha todos os campos corretamente.', 'error');
            }
            try {
                await dataService.addDocument("products", { name, price, quantity, storeId: state.selectedStore.id });
                showToast('Produto adicionado com sucesso!', 'success');
                form.reset();
            } catch (error) { showToast('Erro ao adicionar produto.', 'error'); }
        }
        
        // Formulário de filtro de pedidos
        else if (e.target.id === 'filter-form') {
            // Lógica de filtro será chamada aqui no futuro
            showToast('Filtro aplicado!', 'success');
        }
        
        // Formulário de adicionar usuário (Configurações)
        else if (e.target.id === 'add-user-form') {
            // ... lógica para adicionar usuário ...
        }
    });

    appContainer.addEventListener('click', e => {
        // Botão de remover produto
        const removeProductBtn = e.target.closest('.remove-product-btn');
        if (removeProductBtn) {
            const productId = removeProductBtn.dataset.productId;
            showConfirmModal('Tem certeza que quer remover este produto?', async () => {
                try {
                    await dataService.deleteDocument('products', productId);
                    showToast('Produto removido!', 'success');
                } catch {
                    showToast('Erro ao remover produto.', 'error');
                }
            });
        }

        // Botões na view de Clientes
        const clientBtn = e.target.closest('button[data-client-id]');
        if (clientBtn) {
            const clientId = clientBtn.dataset.clientId;
            const client = state.db.clients.find(c => c.id === clientId);
            if (!client) return;

            if (clientBtn.classList.contains('edit-client-btn')) {
                prepareEditClient(client);
            } else if (clientBtn.classList.contains('remove-client-btn')) {
                showConfirmModal('Tem certeza que quer remover este cliente?', async () => {
                   await dataService.deleteDocument('clients', clientId);
                   showToast('Cliente removido.');
                });
            } else if (clientBtn.classList.contains('view-client-btn')) {
                // Lógica para ver detalhes do cliente
            }
        }
    });
}

// Inicia a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);