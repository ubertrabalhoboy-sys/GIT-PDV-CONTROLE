// js/views/caixa.js

import { state, uiState } from '../state.js';
import { formatCurrency } from '../utils/formatters.js';

export function renderCaixa() {
    const view = document.getElementById('caixa-view');
    const itemsContainer = view.querySelector('#current-order-items');
    const totalEl = view.querySelector('#current-order-total');
    const finalizeBtn = view.querySelector('#finalize-order-button');
    
    // Limpa o conteúdo anterior
    itemsContainer.innerHTML = '';
    
    if (state.currentOrder.length === 0) {
        itemsContainer.innerHTML = '<p id="no-items-message" class="text-slate-500 dark:text-slate-400 text-center py-4">Nenhum item adicionado.</p>';
        finalizeBtn.disabled = true;
    } else {
        state.currentOrder.forEach((item, i) => {
            const el = document.createElement('div');
            el.className = 'flex justify-between items-center bg-slate-200/50 dark:bg-slate-800/50 p-3 rounded-md';

            const stockIcon = item.productId ? `<i data-lucide="package" class="w-4 h-4 text-slate-500 mr-2" title="Item do Estoque"></i>` : '';

            el.innerHTML = `
                <div class="flex items-center">
                    ${stockIcon}
                    <div>
                        <p class="font-semibold text-slate-800 dark:text-slate-200">${item.name}</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400">Troca: ${item.exchange || 'N/A'}</p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <span class="font-semibold text-slate-800 dark:text-slate-200">${formatCurrency(item.value)}</span>
                    <button data-index="${i}" class="remove-item-btn text-red-500 hover:text-red-700 transition-colors">
                        <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                    </button>
                </div>`;
            itemsContainer.appendChild(el);
        });
        finalizeBtn.disabled = false;
    }

    totalEl.textContent = formatCurrency(state.currentOrder.reduce((sum, i) => sum + i.value, 0));
    window.lucide.createIcons();
}