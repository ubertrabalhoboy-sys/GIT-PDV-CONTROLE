/**
 * Módulo de Gestão de Produtos.
 * Lida com a UI e a lógica para listar, adicionar, editar e remover produtos.
 *
 * @file Lógica para a página de gestão de produtos.
 * @summary Conecta a UI de produtos com a API do Firestore.
 */

import { getProductsPaginated, addProduct, updateProduct, deleteProduct } from './firebaseApi.js';
import { getSelectedStore } from './auth.js';
import { formatCurrency, showToast, showConfirmModal } from './utils.js';

let currentPage = 1;
let lastVisibleDoc = null;
let currentEditingId = null;

function renderProductsView(products) {
    const viewContainer = document.getElementById('products-view');
    viewContainer.innerHTML = `
    <div class="space-y-6">
        <div class="custom-card p-6 rounded-lg">
            <h3 id="product-form-title" class="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Adicionar Novo Produto</h3>
            <form id="product-form" class="space-y-4">
                <input type="hidden" id="product-id">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label for="product-name" class="block text-sm font-medium">Nome</label>
                        <input type="text" id="product-name" required class="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-800/50">
                    </div>
                    <div>
                        <label for="product-quantity" class="block text-sm font-medium">Estoque</label>
                        <input type="number" id="product-quantity" required class="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-800/50">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="product-cost" class="block text-sm font-medium">Custo (R$)</label>
                        <input type="number" id="product-cost" step="0.01" required class="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-800/50">
                    </div>
                    <div>
                        <label for="product-price" class="block text-sm font-medium">Preço Venda (R$)</label>
                        <input type="number" id="product-price" step="0.01" required class="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-800/50">
                    </div>
                </div>
                <div class="flex justify-end gap-2 pt-2">
                    <button type="button" id="cancel-edit-btn" class="hidden py-2 px-4 rounded-md text-sm bg-slate-200 dark:bg-slate-600">Cancelar</button>
                    <button type="submit" id="product-form-submit-btn" class="py-2 px-4 rounded-md text-sm text-white bg-brand-primary hover:bg-blue-700 flex items-center gap-2">
                        <i data-lucide="plus-circle" class="w-4 h-4"></i><span>Adicionar</span>
                    </button>
                </div>
            </form>
        </div>
        <div class="custom-card rounded-lg p-4">
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left">
                    <thead class="text-xs text-slate-700 uppercase bg-slate-200/50 dark:bg-slate-800/50">
                        <tr>
                            <th class="px-6 py-3">Produto</th>
                            <th class="px-6 py-3 text-center">Estoque</th>
                            <th class="px-6 py-3 text-right">Preço</th>
                            <th class="px-6 py-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody id="products-table-body">
                        ${renderProductsTable(products)}
                    </tbody>
                </table>
            </div>
            <div id="products-pagination" class="flex justify-between items-center pt-4">
                <button id="prev-page-btn" class="py-1 px-3 rounded-md bg-slate-300 dark:bg-slate-700" disabled>Anterior</button>
                <span>Página ${currentPage}</span>
                <button id="next-page-btn" class="py-1 px-3 rounded-md bg-slate-300 dark:bg-slate-700">Próxima</button>
            </div>
        </div>
    </div>
    `;
    window.lucide.createIcons();
    attachProductEventListeners();
}

function renderProductsTable(products) {
    if (products.length === 0) {
        return `<tr><td colspan="4" class="text-center p-8 text-slate-500">Nenhum produto encontrado.</td></tr>`;
    }
    return products.map(product => {
        const stockClass = product.quantity <= 5 ? 'text-red-500 font-bold' : '';
        return `
            <tr class="border-b dark:border-slate-700">
                <td class="px-6 py-4 font-medium">${product.name}</td>
                <td class="px-6 py-4 text-center ${stockClass}">${product.quantity}</td>
                <td class="px-6 py-4 text-right">${formatCurrency(product.price)}</td>
                <td class="px-6 py-4 text-center space-x-2">
                    <button data-id="${product.id}" class="edit-product-btn text-amber-500"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                    <button data-id="${product.id}" class="remove-product-btn text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}


async function loadProducts(direction = 'next') {
    const store = getSelectedStore();
    const { items, lastVisible } = await getProductsPaginated(store.id, { lastVisible: lastVisibleDoc });
    
    if (items.length > 0) {
        lastVisibleDoc = lastVisible;
        document.getElementById('products-table-body').innerHTML = renderProductsTable(items);
        window.lucide.createIcons();
    } else {
        showToast("Não há mais produtos para mostrar.", "info");
    }
}

function attachProductEventListeners() {
    // ... Event listeners for form submission, edit, delete, pagination
}

export async function initProductsView() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '<div id="products-view" class="view active fade-in"></div>';
    await loadProducts(); // Load initial page
}