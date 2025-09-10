// js/views/metas.js

import { state } from '../../state.js';
import { formatCurrency } from '../utils/formatters.js';

function updateGoalsUI(sales) {
    const goals = state.db.settings.goals || {};
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), diff);
    weekStart.setHours(0,0,0,0);

    const vendasHoje = sales.filter(s => s.date.toDate() >= todayStart).reduce((sum, s) => sum + s.total, 0);
    const vendasSemana = sales.filter(s => s.date.toDate() >= weekStart).reduce((sum, s) => sum + s.total, 0);
    const vendasMes = sales.filter(s => s.date.toDate() >= monthStart).reduce((sum, s) => sum + s.total, 0);

    const salesByDay = sales.reduce((acc, s) => {
        const saleDate = s.date.toDate();
        const dayKey = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate()).toISOString().split('T')[0];
        acc[dayKey] = (acc[dayKey] || 0) + s.total;
        return acc;
    }, {});

    const melhorDiaValor = Math.max(0, ...Object.values(salesByDay));

    const getWeekIdentifier = (d) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
        return `${date.getUTCFullYear()}-W${weekNo}`;
    };

    const salesByWeek = sales.reduce((acc, s) => {
        const week = getWeekIdentifier(s.date.toDate());
        acc[week] = (acc[week] || 0) + s.total;
        return acc;
    }, {});
    const melhorSemanaValor = Math.max(0, ...Object.values(salesByWeek));

    let streak = 0;
    let currentDay = new Date(new Date().setHours(0, 0, 0, 0));
    for (let i = 0; i < 365; i++) {
        const dayKey = currentDay.toISOString().split('T')[0];
        if ((salesByDay[dayKey] || 0) >= (goals.daily || 0.01)) {
            streak++;
        } else if (i > 0) { // Break if not today and streak is broken
            break;
        }
        currentDay.setDate(currentDay.getDate() - 1);
    }
    
    const updateProgressBar = (barId, textId, current, goal) => {
        const bar = document.getElementById(barId);
        const text = document.getElementById(textId);
        if (bar && text) {
            const percentage = Math.min(100, (current / (goal || 1)) * 100);
            bar.style.width = `${percentage}%`;
            text.textContent = `${formatCurrency(current)} / ${formatCurrency(goal)}`;
        }
    };

    updateProgressBar('progresso-diario-barra', 'progresso-diario-texto', vendasHoje, goals.daily);
    updateProgressBar('progresso-semanal-barra', 'progresso-semanal-texto', vendasSemana, goals.weekly);
    updateProgressBar('progresso-mensal-barra', 'progresso-mensal-texto', vendasMes, goals.monthly);
    document.getElementById('recorde-dias-consecutivos').textContent = streak;
    document.getElementById('recorde-melhor-dia').textContent = formatCurrency(melhorDiaValor);
    document.getElementById('recorde-melhor-semana').textContent = formatCurrency(melhorSemanaValor);
}


export function renderMetas() {
    // A lógica de escuta do Firestore será gerenciada pelo main.js
    // Esta função agora apenas atualiza a UI com os dados do estado atual.
    const mySales = state.db.sales.filter(s => s.vendedor === state.loggedInUser.name);
    updateGoalsUI(mySales);
}