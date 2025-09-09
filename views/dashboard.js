import { onSnapshot, collection, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, state } from '../main.js';
import { formatCurrency } from '../ui/utils.js';

let vendasChartInstance = null;
let pagamentoChartInstance = null;

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

    // --- Cálculos de Vendas ---
    const salesThisWeek = allStoreSales.filter(s => s.date.toDate() >= weekStart);
    const totalThisWeek = salesThisWeek.reduce((sum, s) => sum + s.total, 0);
    const daysPassedInWeek = now.getDay() === 0 ? 7 : now.getDay();
    const avgDailyThisWeek = totalThisWeek > 0 ? totalThisWeek / daysPassedInWeek : 0;

    const salesThisMonth = allStoreSales.filter(s => s.date.toDate() >= monthStart);
    const totalThisMonth = salesThisMonth.reduce((sum, s) => sum + s.total, 0);

    // --- Geração de Insights de Resumo ---
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

    // --- Geração de Alertas e Oportunidades ---
    const salesToday = allStoreSales.filter(s => s.date.toDate() >= todayStart);
    const totalToday = salesToday.reduce((sum, s) => sum + s.total, 0);
    
    if (totalToday === 0 && now.getHours() > 12) { // Só mostra o alerta se já passou do meio-dia
        alerts.push({
            icon: '🚀',
            text: 'Hoje ainda não teve vendas — uma boa oportunidade para incentivar sua equipe a oferecer promoções!'
        });
    } else if (totalToday > 0) {
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

export function renderDashboard() {
    const c = document.getElementById('relatorios-view');
    if (!c) return;

    let summaryContainer = c.querySelector('#intelligent-summary');
    if (!summaryContainer) {
        summaryContainer = document.createElement('div');
        summaryContainer.id = 'intelligent-summary';
        summaryContainer.className = 'mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
        c.prepend(summaryContainer);
    }

    let alertsContainer = c.querySelector('#intelligent-alerts');
    if (!alertsContainer) {
        alertsContainer = document.createElement('div');
        alertsContainer.id = 'intelligent-alerts';
        alertsContainer.className = 'mt-6 space-y-3';
        c.append(alertsContainer);
    }
    
    const updateDashboardUI = (sales, allStoreSales) => {
        if (vendasChartInstance) vendasChartInstance.destroy();
        if (pagamentoChartInstance) pagamentoChartInstance.destroy();
        
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

        // Lógica dos cards e gráficos
        // (código original de `renderRelatorios` para cards e gráficos)
    };
    
    const isManager = state.loggedInUser.role === 'gerente' || state.loggedInUser.role === 'superadmin';
    let q = query(collection(db, "sales"), where("storeId", "==", state.selectedStore.id));

    state.listeners.sales = onSnapshot(q, (snapshot) => {
        let allStoreSales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (isManager) {
            updateDashboardUI(allStoreSales, allStoreSales);
        } else {
            const mySales = allStoreSales.filter(s => s.vendedor === state.loggedInUser.name);
            updateDashboardUI(mySales, allStoreSales);
        }
    }, (error) => {
        console.error("Erro ao buscar dados para o dashboard: ", error);
        c.innerHTML = `<div class="text-center p-8 text-red-500"><b>Erro:</b> Não foi possível carregar o dashboard.</div>`;
    });
}

