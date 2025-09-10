// js/views/pedidos.js

import { state } from '../state.js';
import { formatCurrency } from '../utils/formatters.js';

function updateDashboard(sales) {
    const c = document.getElementById('pedidos-view');
    const isGerente = state.loggedInUser.role === 'gerente' || state.loggedInUser.role === 'superadmin';
    if (isGerente || !c) return;

    const totalSales = sales.length;
    const totalValue = sales.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
    c.querySelector('#pedidos-finalizados').textContent = totalSales;
    c.querySelector('#valor-total').textContent = formatCurrency(totalValue);
    c.querySelector('#ticket-medio').textContent = formatCurrency(totalSales > 0 ? totalValue / totalSales : 0);
}

function renderTable(sales) {
    const c = document.getElementById('pedidos-view');
    const tbody = c.querySelector('#orders-table-body');
    const isGerente = state.loggedInUser.role === 'gerente' || state.loggedInUser.role === 'superadmin';
    tbody.innerHTML = '';

    if (!sales || sales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center p-8 text-slate-500">Nenhum pedido encontrado.</td></tr>`;
        return;
    }
    
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

        r.innerHTML = `
            ${isGerente ? `<td class="px-6 py-4">${s.vendedor}</td>` : ''}
            <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">${s.clientName}</td>
            <td class="px-6 py-4">${new Date(s.date.seconds * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td class="px-6 py-4">${paymentDisplay}</td>
            <td class="px-6 py-4 text-right font-semibold text-slate-800 dark:text-slate-100">${formatCurrency(s.total)}</td>
            <td class="px-6 py-4 text-center">
                <button data-order-id="${s.id}" class="view-details-btn text-brand-primary hover:underline">Detalhes</button>
            </td>
        `;
        tbody.appendChild(r);
    });
}

export function renderPedidos() {
    const c = document.getElementById('pedidos-view');
    const isGerente = state.loggedInUser.role === 'gerente' || state.loggedInUser.role === 'superadmin';

    if (isGerente) {
        c.querySelector('#vendedor-pedidos-dashboard')?.classList.add('hidden');
        c.querySelector('#gerente-vendedor-filter-container').classList.remove('hidden');
        const headerRow = c.querySelector('#orders-table-header-row');
        if (headerRow && !headerRow.innerText.includes('Vendedor')) {
            headerRow.insertAdjacentHTML('afterbegin', '<th scope="col" class="px-6 py-3">Vendedor</th>');
        }
        const select = c.querySelector('#filter-vendedor');
        select.innerHTML = '<option value="Todos">Todos</option>';
        const storeUsers = state.db.users.filter(u => u.storeId === state.selectedStore.id && u.role === 'vendedor');
        const vendedores = [...new Set(storeUsers.map(u => u.name))];
        vendedores.forEach(name => {
            select.innerHTML += `<option value="${name}">${name}</option>`;
        });
    }

    renderTable(state.db.sales);
    if (!isGerente) {
        updateDashboard(state.db.sales);
    }
}