import { collection, addDoc, setDoc, doc, deleteDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, state } from '../main.js';
import { showToast, showConfirmModal, formatDate, formatCurrency } from '../ui/utils.js';

export function renderClientes() {
    const view = document.getElementById('clientes-view');
    const form = view.querySelector('#add-client-form');
    const tableBody = view.querySelector('#clients-table-body');
    const searchInput = view.querySelector('#client-search');
    let currentEditingId = null;

    const resetForm = () => {
        form.reset();
        form.querySelector('#client-form-id').value = '';
        view.querySelector('#client-form-title').textContent = 'Adicionar Novo Cliente';
        view.querySelector('#client-form-btn-text').textContent = 'Salvar Cliente';
        view.querySelector('#client-form-cancel').classList.add('hidden');
        currentEditingId = null;
    }

    const renderClientsTable = (clients) => {
        tableBody.innerHTML = '';
        const clientsToRender = clients || state.db.clients;

        if (clientsToRender.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" class="text-center p-8 text-slate-500">Nenhum cliente cadastrado.</td></tr>`;
            return;
        }

        const sortedClients = [...clientsToRender].sort((a, b) => a.name.localeCompare(b.name));

        sortedClients.forEach(client => {
            const row = `
                <tr class="bg-white/50 dark:bg-slate-900/50 border-b border-slate-300 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800/50">
                    <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">${client.name}</td>
                    <td class="px-6 py-4">${client.phone || 'N/A'}</td>
                    <td class="px-6 py-4 text-center space-x-2">
                        <button data-client-id="${client.id}" class="view-client-btn text-blue-500 hover:text-blue-700" title="Ver Detalhes"><i data-lucide="eye" class="w-4 h-4 pointer-events-none"></i></button>
                        <button data-client-id="${client.id}" class="edit-client-btn text-amber-500 hover:text-amber-700" title="Editar"><i data-lucide="edit-2" class="w-4 h-4 pointer-events-none"></i></button>
                        <button data-client-id="${client.id}" class="remove-client-btn text-red-500 hover:text-red-700" title="Remover"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
        window.lucide.createIcons();
    };

    searchInput.addEventListener('input', () => {
        const term = searchInput.value.toLowerCase();
        const filteredClients = state.db.clients.filter(c => 
            c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term))
        );
        renderClientsTable(filteredClients);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const clientData = {
            name: view.querySelector('#client-form-name').value,
            phone: view.querySelector('#client-form-phone').value,
            email: view.querySelector('#client-form-email').value,
            address: view.querySelector('#client-form-address').value,
            storeId: state.selectedStore.id
        };

        try {
            if (currentEditingId) {
                await setDoc(doc(db, "clients", currentEditingId), clientData);
                showToast('Cliente atualizado com sucesso!', 'success');
            } else {
                await addDoc(collection(db, "clients"), clientData);
                showToast('Cliente adicionado com sucesso!', 'success');
            }
            resetForm();
        } catch (error) {
            console.error("Erro ao salvar cliente:", error);
            showToast('Erro ao salvar cliente.', 'error');
        }
    });
    
    form.addEventListener('reset', () => setTimeout(resetForm, 0));

    tableBody.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        
        const clientId = btn.dataset.clientId;

        if (btn.classList.contains('remove-client-btn')) {
            showConfirmModal('Tem certeza que deseja remover este cliente? A ação não pode ser desfeita.', async () => {
                try {
                    await deleteDoc(doc(db, "clients", clientId));
                    showToast('Cliente removido!', 'success');
                } catch (error) { showToast('Erro ao remover cliente.', 'error'); }
            });
        } else if (btn.classList.contains('edit-client-btn')) {
            const client = state.db.clients.find(c => c.id === clientId);
            if(client) {
                currentEditingId = client.id;
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
        } else if (btn.classList.contains('view-client-btn')) {
             const client = state.db.clients.find(c => c.id === clientId);
             const salesQuery = query(collection(db, "sales"), where("clientId", "==", clientId));
             const salesSnapshot = await getDocs(salesQuery);
             const clientSales = salesSnapshot.docs.map(doc => doc.data());

             const modal = document.getElementById('client-details-modal');
             modal.classList.remove('hidden');

             const totalSpent = clientSales.reduce((acc, sale) => acc + sale.total, 0);

             let salesHTML = '<p class="text-sm text-slate-500">Nenhuma compra registrada.</p>';
             if (clientSales.length > 0) {
                  salesHTML = `<ul class="space-y-2 text-sm max-h-60 overflow-y-auto pr-2">` + clientSales.sort((a,b) => b.date.seconds - a.date.seconds).map(sale => `
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
    });
    
    renderClientsTable();
}

