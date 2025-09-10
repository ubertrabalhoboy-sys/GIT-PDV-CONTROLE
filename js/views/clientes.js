// js/views/clientes.js

import { state, uiState } from '../../state.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';

let currentFormState = {
    currentEditingId: null,
};

export function resetClientForm() {
    const view = document.getElementById('clientes-view');
    const form = view.querySelector('#add-client-form');
    form.reset();
    form.querySelector('#client-form-id').value = '';
    view.querySelector('#client-form-title').textContent = 'Adicionar Novo Cliente';
    view.querySelector('#client-form-btn-text').textContent = 'Salvar Cliente';
    view.querySelector('#client-form-cancel').classList.add('hidden');
    currentFormState.currentEditingId = null;
}

function renderClientsTable(clientsToRender) {
    const tableBody = document.getElementById('clients-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (clientsToRender.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" class="text-center p-8 text-slate-500">Nenhum cliente encontrado.</td></tr>`;
        return;
    }

    const sortedClients = [...clientsToRender].sort((a, b) => a.name.localeCompare(b.name));

    sortedClients.forEach(client => {
        const row = document.createElement('tr');
        row.className = 'bg-white/50 dark:bg-slate-900/50 border-b border-slate-300 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800/50';
        row.innerHTML = `
            <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">${client.name}</td>
            <td class="px-6 py-4">${client.phone || 'N/A'}</td>
            <td class="px-6 py-4 text-center space-x-2">
                <button data-client-id="${client.id}" class="view-client-btn text-blue-500 hover:text-blue-700" title="Ver Detalhes"><i data-lucide="eye" class="w-4 h-4 pointer-events-none"></i></button>
                <button data-client-id="${client.id}" class="edit-client-btn text-amber-500 hover:text-amber-700" title="Editar"><i data-lucide="edit-2" class="w-4 h-4 pointer-events-none"></i></button>
                <button data-client-id="${client.id}" class="remove-client-btn text-red-500 hover:text-red-700" title="Remover"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    window.lucide.createIcons();
}

export function handleClientSearch(searchTerm) {
    const filteredClients = state.db.clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm) || (c.phone && c.phone.includes(searchTerm))
    );
    renderClientsTable(filteredClients);
}

export function prepareEditClient(client) {
    const view = document.getElementById('clientes-view');
    currentFormState.currentEditingId = client.id;
    view.querySelector('#client-form-id').value = client.id;
    view.querySelector('#client-form-name').value = client.name;
    view.querySelector('#client-form-phone').value = client.phone || '';
    view.querySelector('#client-form-email').value = client.email || '';
    view.querySelector('#client-form-address').value = client.address || '';
    view.querySelector('#client-form-title').textContent = 'Editando Cliente';
    view.querySelector('#client-form-btn-text').textContent = 'Atualizar';
    view.querySelector('#client-form-cancel').classList.remove('hidden');
    view.querySelector('#client-form-name').focus();
}

export function getClientFormData(form) {
    return {
        id: currentFormState.currentEditingId,
        data: {
            name: form.querySelector('#client-form-name').value,
            phone: form.querySelector('#client-form-phone').value,
            email: form.querySelector('#client-form-email').value,
            address: form.querySelector('#client-form-address').value,
            storeId: state.selectedStore.id
        }
    };
}

export function renderClientDetailsModal(client, clientSales) {
    const modal = document.getElementById('client-details-modal');
    modal.classList.remove('hidden');

    const totalSpent = clientSales.reduce((acc, sale) => acc + sale.total, 0);

    let salesHTML = '<p class="text-sm text-slate-500">Nenhuma compra registrada.</p>';
    if (clientSales.length > 0) {
        salesHTML = `<ul class="space-y-2 text-sm max-h-60 overflow-y-auto pr-2">` + clientSales.sort((a, b) => b.date.seconds - a.date.seconds).map(sale => `
            <li class="p-2 bg-slate-200/50 dark:bg-slate-800/50 rounded-md">
                <div class="flex justify-between font-semibold">
                    <span>${formatDate(sale.date)}</span>
                    <span>${formatCurrency(sale.total)}</span>
                </div>
                <ul class="list-disc list-inside text-xs text-slate-600 dark:text-slate-400">
                    ${sale.items.map(item => `<li>${item.name}</li>`).join('')}
                </ul>
            </li>
        `).join('') + `</ul>`;
    }

    modal.innerHTML = `
        <div class="custom-card rounded-lg shadow-xl w-full max-w-2xl p-6 m-4 fade-in">
            <div class="flex justify-between items-center border-b dark:border-slate-700 pb-3 mb-4">
                <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">${client.name}</h2>
                <button id="close-client-details-modal" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><i data-lucide="x" class="w-6 h-6"></i></button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 class="font-bold mb-2">Informações de Contato</h4>
                    <p><strong class="font-medium">Telefone:</strong> ${client.phone || 'N/A'}</p>
                    <p><strong class="font-medium">Email:</strong> ${client.email || 'N/A'}</p>
                    <p><strong class="font-medium">Endereço:</strong> ${client.address || 'N/A'}</p>
                    <hr class="my-3 dark:border-slate-700">
                    <h4 class="font-bold">Total Gasto na Loja:</h4>
                    <p class="text-xl font-bold text-brand-primary">${formatCurrency(totalSpent)}</p>
                </div>
                <div>
                    <h4 class="font-bold mb-2">Histórico de Compras (${clientSales.length})</h4>
                    ${salesHTML}
                </div>
            </div>
        </div>
    `;
    window.lucide.createIcons();
    modal.querySelector('#close-client-details-modal').addEventListener('click', () => modal.classList.add('hidden'));
}


export function renderClientes() {
    renderClientsTable(state.db.clients);
}