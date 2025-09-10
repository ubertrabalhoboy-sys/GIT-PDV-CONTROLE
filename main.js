import { db, auth } from './config/firebase.js';
import { initializeListeners, detachAllListeners } from './services/data.js';
import { handleLogin, handleLogout, handleUserCreation } from './services/auth.js';
import { applyTheme, setupThemeToggle } from './ui/theme.js';
import { setupMobileMenu, showToast } from './ui/utils.js';
import { renderLogin, loadInitialData } from './views/login.js';
import { renderCaixa } from './views/caixa.js';
import { renderPedidos } from './views/pedidos.js';
import { renderClientes } from './views/clientes.js';
import { renderProdutos } from './views/produtos.js';
import { renderMetas } from './views/metas.js';
import { renderRanking } from './views/ranking.js';
import { renderDashboard } from './views/dashboard.js';
import { renderConfiguracoes } from './views/configuracoes.js';

export let state = {
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
            ownerPhone: ''
        },
        sales: []
    },
    listeners: { users: null, sales: null, stores: null, products: null, clients: null },
    selectedStore: null
};

const viewRenderers = {
    caixa: renderCaixa,
    pedidos: renderPedidos,
    clientes: renderClientes,
    produtos: renderProdutos,
    metas: renderMetas,
    ranking: renderRanking,
    relatorios: renderDashboard,
    configuracoes: renderConfiguracoes,
};

export function updateState(newState) {
    state = { ...state, ...newState };
}

export function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active', 'fade-in'));
    const activeView = document.getElementById(`${viewId}-view`);
    if (activeView) {
        activeView.classList.add('active', 'fade-in');
        updateState({ currentView: viewId });
        const link = document.querySelector(`#sidebar a[data-view="${viewId}"]`);
        if (link) {
            document.getElementById('current-view-title').textContent = link.querySelector('span').textContent;
            document.querySelectorAll('#sidebar ul li a').forEach(l => l.classList.remove('bg-slate-700', 'text-white'));
            link.classList.add('bg-slate-700', 'text-white');
        }
        renderViewContent(viewId);
    }
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');
}

export function renderViewContent(viewId) {
    const viewContainer = document.getElementById(`${viewId}-view`);
    const template = document.getElementById(`${viewId}-template`);
    
    if (!template) {
        console.error(`Template para a view "${viewId}" não encontrado.`);
        return;
    }
    viewContainer.innerHTML = template.innerHTML;

    if (viewRenderers[viewId]) {
        viewRenderers[viewId]();
    }
    window.lucide.createIcons();
}

export async function initializeAppUI() {
    const user = state.loggedInUser;
    const store = state.selectedStore;

    if (!user || !user.role) {
        console.error("ERRO CRÍTICO: Usuário sem 'role'. Logout forçado.");
        await handleLogout();
        return;
    }

    document.getElementById('store-name-sidebar').textContent = store.name;
    document.getElementById('username-sidebar').textContent = user.name;
    document.getElementById('user-icon').textContent = user.name.charAt(0).toUpperCase();

    initializeListeners();

    const createMenuItem = (v, i, t) => `<li><a href="#" data-view="${v}" class="flex items-center p-2 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white group transition-colors"><i data-lucide="${i}" class="w-5 h-5"></i><span class="ml-3">${t}</span></a></li>`;
    const createLogoutItem = () => `<li class="pt-2 mt-2 border-t border-slate-700"><button data-action="logout" class="w-full flex items-center p-2 text-red-400 rounded-lg hover:bg-red-500 hover:text-white group transition-colors"><i data-lucide="log-out" class="w-5 h-5"></i><span class="ml-3">Sair</span></button></li>`;

    const vM = document.getElementById('vendedor-menu');
    const gM = document.getElementById('gerente-menu');
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
    window.lucide.createIcons();
}

function init() {
    // Em main.js, dentro da função init(), adicione este bloco:

// ADICIONE ESTE BLOCO PARA GERENCIAR PRODUTOS
document.getElementById('app').addEventListener('submit', async (e) => {
    if (e.target.id === 'add-product-form') {
        e.preventDefault();
        const form = e.target;
        const name = form.querySelector('#product-name').value;
        const price = parseFloat(form.querySelector('#product-price').value);
        const quantity = parseInt(form.querySelector('#product-quantity').value);

        if (!name || isNaN(price) || isNaN(quantity)) {
            return showToast('Por favor, preencha todos os campos.', 'error');
        }

        try {
            await addDoc(collection(db, "products"), { name, price, quantity, storeId: state.selectedStore.id });
            showToast('Produto adicionado!', 'success');
            form.reset();
        } catch (error) {
            showToast('Erro ao adicionar produto.', 'error');
        }
    }
});

document.getElementById('app').addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.remove-product-btn');
    if (removeBtn) {
        const productId = removeBtn.dataset.productId;
        showConfirmModal('Tem certeza que deseja remover este produto?', async () => {
            try {
                await deleteDoc(doc(db, "products", productId));
                showToast('Produto removido!', 'success');
            } catch (error) {
                showToast('Erro ao remover produto.', 'error');
            }
        });
    }
});
// FIM DO BLOCO A SER ADICIONADO
    const theme = localStorage.getItem('theme') || 'dark';
    applyTheme(theme);
    setupThemeToggle();
    setupMobileMenu();

    document.getElementById('sidebar').addEventListener('click', async (e) => {
        const link = e.target.closest('a[data-view]');
        const logoutBtn = e.target.closest('button[data-action="logout"]');
        if (link) {
            e.preventDefault();
            switchView(link.dataset.view);
        }
        if (logoutBtn) {
            await handleLogout();
        }
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

    renderLogin();
    loadInitialData();
}

document.addEventListener('DOMContentLoaded', init);