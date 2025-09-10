import { state, uiState, resetState } from './state.js';
import { loginUser, logoutUser, createAuthUser } from './services/auth.js';
import * as dataService from './services/dataService.js';
import { applyTheme, setupThemeToggle } from './utils/theme.js';
import * as formatters from './utils/formatters.js';
import * as domUtils from './utils/domUtils.js';

// Import all view renderers
import { renderCaixa } from './views/caixa.js';
import { renderClientes } from './views/clientes.js';
import { renderConfiguracoes } from './views/configuracoes.js';
import { renderDashboard } from './views/dashboard.js';
import { renderLogin } from './views/login.js';
import { renderMetas } from './views/metas.js';
import { renderPedidos } from './views/pedidos.js';
import { renderProdutos } from './views/produtos.js';
import { renderRanking } from './views/ranking.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- INITIALIZATION ---
    function init() {
        setupThemeToggle(() => {
            // Callback to re-render views that have charts after theme change
            if (['relatorios', 'metas', 'ranking'].includes(state.currentView)) {
                switchView(state.currentView);
            }
        });
        window.lucide.createIcons();
        setupEventListeners();
        renderLogin.loadInitialData(); // Start the app
    }

    // --- VIEW MANAGEMENT ---
    function switchView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active', 'fade-in'));
        const activeView = document.getElementById(`${viewId}-view`);
        if (activeView) {
            state.currentView = viewId;
            activeView.classList.add('active', 'fade-in');

            // Update header title and sidebar highlight
            const link = document.querySelector(`#sidebar a[data-view="${viewId}"]`);
            if (link) {
                document.getElementById('current-view-title').textContent = link.querySelector('span').textContent;
                document.querySelectorAll('#sidebar ul li a').forEach(l => l.classList.remove('bg-slate-700', 'text-white'));
                link.classList.add('bg-slate-700', 'text-white');
            }

            renderViewContent(viewId);
        }
        domUtils.showMobileMenu(false);
    }

    function renderViewContent(viewId) {
        const viewContainer = document.getElementById(`${viewId}-view`);
        const template = document.getElementById(`${viewId}-template`);
        if (!template) {
            console.error(`Template para a view "${viewId}" não encontrado.`);
            return;
        }
        viewContainer.innerHTML = template.innerHTML;
        
        // Dynamically call the correct render function
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

    // --- EVENT LISTENERS (Delegated) ---
    function setupEventListeners() {
        // ... (You would move all your addEventListener calls here, delegating from parent elements)
        // Example for sidebar:
        document.getElementById('sidebar').addEventListener('click', (e) => {
            const link = e.target.closest('a[data-view]');
            if (link) {
                e.preventDefault();
                switchView(link.dataset.view);
            }
            const logoutBtn = e.target.closest('button[data-action="logout"]');
            if(logoutBtn) {
                handleLogout();
            }
        });

        // Other listeners for login forms, buttons, etc.
    }
    
    // --- AUTHENTICATION HANDLERS ---
    async function handleLogout() {
        await logoutUser();
        resetState();
        document.getElementById('app').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        renderLogin.loadInitialData();
    }


    // Make key functions globally accessible for the views if needed, or pass them as arguments
    window.App = {
        switchView,
        state,
        uiState,
        services: { ...dataService, loginUser, logoutUser, createAuthUser },
        utils: { ...formatters, ...domUtils },
    };

    init();
});