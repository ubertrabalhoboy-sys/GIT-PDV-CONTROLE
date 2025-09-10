// js/views/produtos.js

import { state } from '../../state.js';
import { formatCurrency } from '../utils/formatters.js';

export function renderProdutos() {
    const view = document.getElementById('produtos-view');
    if (!view) return;
    const tableBody = view.querySelector('#products-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (state.db.products.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-slate-500">Nenhum produto cadastrado.</td></tr>`;
        return;
    }

    const sortedProducts = [...state.db.products].sort((a, b) => a.name.localeCompare(b.name));

    sortedProducts.forEach(product => {
        const stockClass = product.quantity <= 5 ? 'text-red-500 font-bold' : (product.quantity <= 10 ? 'text-amber-500 font-semibold' : '');
        const row = document.createElement('tr');
        row.className = 'bg-white/50 dark:bg-slate-900/50 border-b border-slate-300 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800/50';
        row.innerHTML = `
            <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">${product.name}</td>
            <td class="px-6 py-4 text-center ${stockClass}">${product.quantity}</td>
            <td class="px-6 py-4 text-right">${formatCurrency(product.price)}</td>
            <td class="px-6 py-4 text-center">
                <button data-product-id="${product.id}" class="remove-product-btn text-red-500 hover:text-red-700">
                    <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    window.lucide.createIcons();
}