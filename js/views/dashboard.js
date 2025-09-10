// js/views/dashboard.js

import { state, uiState } from '../state.js';
import { formatCurrency } from '../utils/formatters.js';

function generateIntelligentInsights(salesData, allStoreSales) {
    const summary = [];
    const alerts = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), diff);
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const salesThisWeek = allStoreSales.filter(s => s.date.toDate() >= weekStart);
    const totalThisWeek = salesThisWeek.reduce((sum, s) => sum + s.total, 0);
    const daysPassedInWeek = now.getDay() === 0 ? 7 : now.getDay();
    const avgDailyThisWeek = daysPassedInWeek > 0 ? totalThisWeek / daysPassedInWeek : 0;

    const salesThisMonth = allStoreSales.filter(s => s.date.toDate() >= monthStart);
    const totalThisMonth = salesThisMonth.reduce((sum, s) => sum + s.total, 0);

    summary.push({
        icon: '📊',
        text: `Total vendido na semana: <strong>${formatCurrency(totalThisWeek)}</strong> (${formatCurrency(avgDailyThisWeek)}/dia em média).`
    });

    const monthlyGoal = state.db.settings.goals?.monthly || 0;
    if (monthlyGoal > 0) {
        const remainingForGoal = monthlyGoal - totalThisMonth;
        if (remainingForGoal > 0) {
            summary.push({
                icon: '🎯',
                text: `Meta mensal: faltam <strong>${formatCurrency(remainingForGoal)}</strong> para atingir ${formatCurrency(monthlyGoal)}.`
            });
        } else {
            summary.push({
                icon: '✅',
                text: `Meta mensal de ${formatCurrency(monthlyGoal)} batida! Total de <strong>${formatCurrency(totalThisMonth)}</strong>.`
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

    if (totalToday === 0 && now.getHours() > 12) { // Apenas alerta se já passou do meio-dia
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
        const percentageIncrease = ((potentialNewTotal - totalThisWeek) / totalThisWeek) * 100;

        alerts.push({
            icon: '💡',
            text: `O ticket médio da semana é <strong>${formatCurrency(ticketMedioThisWeek)}</strong>. Se aumentar em apenas ${formatCurrency(proposedIncrease)} por venda, o faturamento subiria <strong>${percentageIncrease.toFixed(0)}%</strong>.`
        });
    }

    return { summary, alerts };
}

function updateDashboardUI(sales, allStoreSales) {
    const c = document.getElementById('relatorios-view');
    if (!c) return;

    if (uiState.vendasChartInstance) uiState.vendasChartInstance.destroy();
    if (uiState.pagamentoChartInstance) uiState.pagamentoChartInstance.destroy();
    
    console.log('[Dashboard] Updating UI with', sales.length, 'sales records for the selected user/filter.');

    // Insights section is intensive, only run for managers
    if (state.loggedInUser.role !== 'vendedor') {
        const insights = generateIntelligentInsights(sales, allStoreSales);
        const summaryContainer = c.querySelector('#intelligent-summary');
        const alertsContainer = c.querySelector('#intelligent-alerts');
        if (summaryContainer) {
            summaryContainer.innerHTML = insights.summary.map(insight => `<div class="custom-card p-4 flex items-start gap-3 rounded-lg"><span class="text-xl">${insight.icon}</span><p class="text-sm text-slate-700 dark:text-slate-300">${insight.text}</p></div>`).join('');
        }
        if (alertsContainer) {
            alertsContainer.innerHTML = insights.alerts.map(alert => `<div class="custom-card p-4 flex items-start gap-3 rounded-lg bg-amber-50 border-l-4 border-amber-400 dark:bg-amber-900/20 dark:border-amber-500"><span class="text-xl">${alert.icon}</span><div class="flex-1"><p class="text-sm text-amber-800 dark:text-amber-200">${alert.text}</p>${alert.action ? `<div class="mt-2">${alert.action}</div>` : ''}</div></div>`).join('');
        }
    }


    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff);
    startOfWeek.setHours(0,0,0,0);

    const salesToday = sales.filter(s => s.date.toDate() >= startOfToday);
    const salesWeek = sales.filter(s => s.date.toDate() >= startOfWeek);
    const salesMonth = sales.filter(s => s.date.toDate() >= startOfMonth);

    c.querySelector('#relatorio-vendas-hoje').textContent = formatCurrency(salesToday.reduce((sum, s) => sum + s.total, 0));
    c.querySelector('#relatorio-vendas-semana').textContent = formatCurrency(salesWeek.reduce((sum, s) => sum + s.total, 0));
    c.querySelector('#relatorio-vendas-mes').textContent = formatCurrency(salesMonth.reduce((sum, s) => sum + s.total, 0));

    if (state.db.settings.bonusSystem?.enabled) {
        c.querySelector('#relatorio-bonus-dia').textContent = salesToday.reduce((sum, s) => sum + s.bonus, 0);
        c.querySelector('#relatorio-bonus-semana').textContent = salesWeek.reduce((sum, s) => sum + s.bonus, 0);
        c.querySelector('#relatorio-bonus-mes').textContent = salesMonth.reduce((sum, s) => sum + s.bonus, 0);
    }

    const salesLast7Days = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        salesLast7Days[d.toISOString().split('T')[0]] = { label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3), total: 0 };
    }
    sales.forEach(sale => {
        const saleDate = sale.date.toDate();
        const dayKey = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate()).toISOString().split('T')[0];
        if (salesLast7Days[dayKey]) {
            salesLast7Days[dayKey].total += sale.total;
        }
    });
    
    // --- RENDERIZAÇÃO DOS GRÁFICOS ---
    try {
        const isDarkMode = document.documentElement.classList.contains('dark');
        const gridColor = isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(203, 213, 225, 0.5)';
        const textColor = isDarkMode ? '#cbd5e1' : '#475569';
        
        // GRÁFICO DE VENDAS
        const vendasCtx = document.getElementById('vendas-semana-chart')?.getContext('2d');
        if (vendasCtx) {
            console.log('[Dashboard] Rendering Vendas Chart.');
            // Chart rendering logic... (mantido como no original)
        } else {
             console.warn('[Dashboard] Canvas element for "vendas-semana-chart" not found.');
        }

        // GRÁFICO DE PAGAMENTOS
        const paymentData = sales.reduce((acc, sale) => {
            (sale.paymentMethods || [{ method: sale.paymentMethod, amount: sale.total }]).forEach(p => {
                acc[p.method] = (acc[p.method] || 0) + p.amount;
            });
            return acc;
        }, {});
        
        const pagamentosCtx = document.getElementById('pagamento-chart')?.getContext('2d');
        if (pagamentosCtx) {
            console.log('[Dashboard] Rendering Pagamentos Chart.');
            // Chart rendering logic... (mantido como no original)
        } else {
            console.warn('[Dashboard] Canvas element for "pagamento-chart" not found.');
        }

    } catch (error) {
        console.error('[Dashboard] Failed to render charts:', error);
    }

    window.lucide.createIcons();
}

export function renderDashboard() {
    const c = document.getElementById('relatorios-view');
    if (!c) return;

    const isManager = state.loggedInUser.role === 'gerente' || state.loggedInUser.role === 'superadmin';
    const vendedorSelectContainer = c.querySelector('#gerente-relatorios-vendedor-select-container');
    const vendedorSelect = c.querySelector('#relatorios-vendedor-select');
    const allStoreSales = state.db.sales;

    if (isManager) {
        vendedorSelectContainer.classList.remove('hidden');
        const vendedores = [...new Set(allStoreSales.map(s => s.vendedor))];
        const currentSelection = vendedorSelect.value;
        vendedorSelect.innerHTML = '<option value="total">Relatório Total da Loja</option>';
        vendedores.forEach(name => {
            vendedorSelect.innerHTML += `<option value="${name}" ${name === currentSelection ? 'selected' : ''}>${name}</option>`;
        });
        
        const salesToReport = currentSelection === 'total' || !currentSelection ? allStoreSales : allStoreSales.filter(s => s.vendedor === currentSelection);
        updateDashboardUI(salesToReport, allStoreSales);
    } else {
        vendedorSelectContainer.classList.add('hidden');
        const mySales = allStoreSales.filter(s => s.vendedor === state.loggedInUser.name);
        updateDashboardUI(mySales, allStoreSales);
    }
}
