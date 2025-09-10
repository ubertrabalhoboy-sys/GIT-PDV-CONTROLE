// js/views/ranking.js

import { state, uiState } from '../state.js';
import { formatCurrency } from '../utils/formatters.js';

export function renderRanking() {
    const view = document.getElementById('ranking-view');
    if (!view) return;

    const podiumContainer = view.querySelector('#ranking-podium-container');
    const listContainer = view.querySelector('#ranking-list-container');
    const period = uiState.currentRankingPeriod;
    const sales = state.db.sales;

    const now = new Date();
    let startDate;

    switch (period) {
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'week':
            const dayOfWeek = now.getDay();
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            startDate = new Date(now.getFullYear(), now.getMonth(), diff);
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

    const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd place
    const podiumHTML = `
        <div class="flex flex-col sm:flex-row justify-center items-end gap-4 sm:gap-2 md:gap-4">
            ${podiumOrder.map(index => {
                const seller = top3[index];
                if (!seller) return '<div class="w-full sm:w-1/3"></div>';
                
                const place = index === 0 ? 2 : (index === 1 ? 1 : 3);
                const heightClasses = ['h-40 sm:h-48', 'h-28 sm:h-32', 'h-20 sm:h-24'];
                const barHeight = place === 1 ? heightClasses[0] : (place === 2 ? heightClasses[1] : heightClasses[2]);
                const colorClasses = ['bg-amber-400 dark:bg-amber-500', 'bg-slate-300 dark:bg-slate-400', 'bg-yellow-600 dark:bg-yellow-700'];
                const podiumColor = place === 1 ? colorClasses[0] : (place === 2 ? colorClasses[1] : colorClasses[2]);
                const podiumIcon = place === 1 ? 'award' : (place === 2 ? 'medal' : 'trophy');
                const iconColor = place === 1 ? 'border-amber-400' : 'border-slate-400 dark:border-slate-500';

                return `
                <div class="w-full sm:w-1/3 text-center flex flex-col items-center">
                    <div class="relative mb-2">
                        <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-3xl sm:text-4xl font-bold border-4 ${iconColor}">
                            ${seller.name.charAt(0)}
                        </div>
                        <div class="absolute -top-2 -right-2 w-8 h-8 bg-slate-800 text-white rounded-full flex items-center justify-center text-sm font-bold border-2 border-white dark:border-slate-900">${place}</div>
                    </div>
                    <p class="font-bold text-slate-800 dark:text-white truncate w-full">${seller.name}</p>
                    <p class="text-sm text-brand-primary font-semibold">${formatCurrency(seller.total)}</p>
                    <div class="w-full ${barHeight} ${podiumColor} rounded-t-lg mt-2 flex items-center justify-center">
                        <i data-lucide="${podiumIcon}" class="w-10 h-10 text-white/50"></i>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    `;
    podiumContainer.innerHTML = podiumHTML;

    if (others.length > 0) {
        listContainer.innerHTML = `
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
    }
    window.lucide.createIcons();
}