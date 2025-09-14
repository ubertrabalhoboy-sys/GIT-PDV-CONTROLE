import { logout, getCurrentUser } from '../services/authService.js';

// Mapeamento de nome da view para a função que a renderiza
// Usamos import() dinâmico para carregar o código da view apenas quando necessário (Code Splitting)
const views = {
    'caixa': () => import('../views/caixaView.js').then(module => module.renderCaixaView),
    'pedidos': () => import('../views/pedidosView.js').then(module => module.renderPedidosView),
    'metas': () => import('../views/metasView.js').then(module => module.renderMetasView),
    'dashboard': () => import('../views/relatoriosView.js').then(module => module.renderRelatoriosView),
    'financeiro': () => import('../views/financeiroView.js').then(module => module.renderFinanceiroView),
    'ranking': () => import('../views/rankingView.js').then(module => module.renderRankingView),
    'clientes': () => import('../views/clientesView.js').then(module => module.renderClientesView),
    'produtos': () => import('../views/produtosView.js').then(module => module.renderProdutosView),
    'configuracoes': () => import('../views/configuracoesView.js').then(module => module.renderConfiguracoesView),
};

// Define quais views cada perfil pode acessar
const rolePermissions = {
    'Vendedor': ['caixa', 'pedidos', 'metas', 'dashboard', 'ranking'],
    'Gerente': ['caixa', 'pedidos', 'dashboard', 'financeiro', 'ranking', 'clientes', 'produtos', 'configuracoes'],
    'Super Admin': ['caixa', 'pedidos', 'dashboard', 'financeiro', 'ranking', 'clientes', 'produtos', 'configuracoes'], // Super Admin herda tudo e tem painel extra em config
};

const mainContent = document.getElementById('main-content');

// Navega para uma view específica
export async function navigateTo(viewName) {
    if (views[viewName]) {
        mainContent.innerHTML = '<div class="spinner mx-auto mt-16"></div>'; // Mostra um spinner
        try {
            const renderFunction = await views[viewName]();
            await renderFunction(mainContent);
            // Atualiza o item de menu ativo
            document.querySelectorAll('#sidebar a').forEach(link => {
                link.classList.toggle('bg-gray-700', link.dataset.view === viewName);
            });
        } catch (error) {
            console.error(`Erro ao carregar a view ${viewName}:`, error);
            mainContent.innerHTML = `<p class="text-red-500">Erro ao carregar a página.</p>`;
        }
    } else {
        console.error(`View "${viewName}" não encontrada.`);
        mainContent.innerHTML = `<p class="text-red-500">Página não encontrada.</p>`;
    }
}

// Renderiza a barra de navegação (sidebar) de acordo com o perfil do usuário
export function renderNavigation(userData) {
    const sidebar = document.getElementById('sidebar');
    const userRoles = rolePermissions[userData.role] || [];
    
    const navLinks = userRoles.map(view => `
        <a href="#" data-view="${view}" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
            ${view.charAt(0).toUpperCase() + view.slice(1)}
        </a>
    `).join('');

    sidebar.innerHTML = `
        <div class="text-xl font-bold mb-10">PDV System</div>
        <nav>${navLinks}</nav>
        <div class="absolute bottom-4 left-4 right-4">
            <div class="text-sm mb-2">Usuário: <strong>${userData.name}</strong></div>
            <div class="text-xs mb-4">Perfil: <strong>${userData.role}</strong></div>
            <button id="logout-btn" class="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">
                Sair
            </button>
        </div>
    `;

    // Adiciona eventos de clique aos links de navegação e ao botão de logout
    sidebar.addEventListener('click', (e) => {
        if (e.target.matches('a[data-view]')) {
            e.preventDefault();
            navigateTo(e.target.dataset.view);
        }
        if (e.target.matches('#logout-btn')) {
            logout();
        }
    });
}

// Mostra a view inicial correta após o login
export function showInitialView(role) {
    if (role === 'Vendedor') {
        navigateTo('caixa');
    } else {
        navigateTo('dashboard');
    }
}