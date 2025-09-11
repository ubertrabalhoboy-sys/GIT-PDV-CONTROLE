// js/views/caixa.js
import { db } from "../firebase.js";
import { collection, addDoc, doc, writeBatch, increment, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast, formatCurrency } from "../utils.js";
import { showBonusWheelModal, showWhatsAppModal } from "../ui.js"; // veremos ui.js exportar esses helpers visuais

export function renderCaixa(state) {
    const view = document.getElementById('caixa-view');
    // (o view HTML já vem do template no index.html)
    const itemsContainer = view.querySelector('#current-order-items');
    const totalEl = view.querySelector('#current-order-total');
    const finalizeBtn = view.querySelector('#finalize-order-button');
    const addForm = view.querySelector('#add-item-form');
    const modalContainer = document.getElementById('finalize-order-modal');

    const productSearchInput = view.querySelector('#product-search');
    const searchResultsContainer = view.querySelector('#product-search-results');
    let selectedProduct = null;

    const updateUI = () => {
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
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>`;
                itemsContainer.appendChild(el);
            });
            finalizeBtn.disabled = false;
        }
        totalEl.textContent = formatCurrency(state.currentOrder.reduce((sum, i) => sum + i.value, 0));
        window.lucide.createIcons();
    };

    addForm.addEventListener('submit', e => {
        e.preventDefault();
        const newItem = {
            name: view.querySelector('#item-name').value,
            value: parseFloat(view.querySelector('#item-value').value),
            exchange: view.querySelector('#item-exchange').value
        };
        if (selectedProduct) newItem.productId = selectedProduct.id;
        state.currentOrder.push(newItem);
        updateUI();
        addForm.reset();
        productSearchInput.value = '';
        selectedProduct = null;
        view.querySelector('#item-name').focus();
    });

    itemsContainer.addEventListener('click', e => {
        const b = e.target.closest('.remove-item-btn');
        if (b) {
            state.currentOrder.splice(b.dataset.index, 1);
            updateUI();
        }
    });

    // Busca produtos (usa state.db.products, que é atualizado por onSnapshot em main.js)
    productSearchInput.addEventListener('input', () => {
        const searchTerm = productSearchInput.value.toLowerCase();
        if (searchTerm.length < 2) {
            searchResultsContainer.innerHTML = '';
            searchResultsContainer.classList.add('hidden');
            return;
        }
        const results = state.db.products.filter(p => p.name.toLowerCase().includes(searchTerm) && p.quantity > 0);
        if (results.length > 0) {
            searchResultsContainer.innerHTML = results.map(p => `
                <div class="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer" data-product-id="${p.id}">
                    <p class="font-semibold text-slate-800 dark:text-slate-200">${p.name}</p>
                    <p class="text-sm text-slate-500">Estoque: ${p.quantity} | ${formatCurrency(p.price)}</p>
                </div>
            `).join('');
            searchResultsContainer.classList.remove('hidden');
        } else {
            searchResultsContainer.classList.add('hidden');
        }
    });

    searchResultsContainer.addEventListener('click', (e) => {
        const resultDiv = e.target.closest('[data-product-id]');
        if (resultDiv) {
            const productId = resultDiv.dataset.productId;
            selectedProduct = state.db.products.find(p => p.id === productId);
            if (selectedProduct) {
                view.querySelector('#item-name').value = selectedProduct.name;
                view.querySelector('#item-value').value = selectedProduct.price;
                searchResultsContainer.classList.add('hidden');
                productSearchInput.value = '';
            }
        }
    });

    // Finalização: abro modal - a lógica de gravação / batch permanece no main.js (ou aqui, conforme preferir)
    // NOTE: para não duplicar lógica, a finalização será tratada em main.js que possui acesso ao state global.
    updateUI();
}
