import { onSnapshot, collection, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, state, updateState } from '../main.js';
import { formatCurrency } from '../ui/utils.js';

export function renderPedidos() {
    const c = document.getElementById('pedidos-view');
    const isGerente = state.loggedInUser.role === 'gerente' || state.loggedInUser.role === 'superadmin';

    if (isGerente) {
        c.querySelector('#vendedor-pedidos-dashboard')?.classList.add('hidden');
        c.querySelector('#gerente-vendedor-filter-container').classList.remove('hidden');
        if (!c.querySelector('#orders-table-header-row').innerText.includes('Vendedor')) {
            c.querySelector('#orders-table-header-row').insertAdjacentHTML('afterbegin', '<th scope="col" class="px-6 py-3">Vendedor</th>');
        }
        const select = c.querySelector('#filter-vendedor');
        select.innerHTML = '<option value="Todos">Todos</option>';
        const storeUsers = state.db.users.filter(u => u.storeId === state.selectedStore.id && u.role === 'vendedor');
        const vendedores = [...new Set(storeUsers.map(u => u.name))];
        vendedores.forEach(name => {
            select.innerHTML += `<option value="${name}">${name}</option>`;
        });
    }

    const updateDashboard = (sales) => {
        if (isGerente) return;
        const totalSales = sales.length;
        const totalValue = sales.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
        c.querySelector('#pedidos-finalizados').textContent = totalSales;
        c.querySelector('#valor-total').textContent = formatCurrency(totalValue);
        c.querySelector('#ticket-medio').textContent = formatCurrency(totalSales > 0 ? totalValue / totalSales : 0);
    };

    const renderTable = (sales) => {
        const tbody = c.querySelector('#orders-table-body');
        tbody.innerHTML = '';
        if (!sales || sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center p-8 text-slate-500">Nenhum pedido encontrado.</td></tr>';
        } else {
            sales.forEach(s => {
                const r = document.createElement('tr');
                r.className = 'bg-white/50 dark:bg-slate-900/50 border-b border-slate-300 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800/50';
                const paymentDisplay = Array.isArray(s.paymentMethods) ? s.paymentMethods.map(p => `${p.method}${p.installments ? ` (${p.installments})` : ''}`).join(' + ') : s.paymentMethod;
                r.innerHTML =
                    `${isGerente ? `<td class="px-6 py-4">${s.vendedor}</td>` : ''}
                        <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">${s.clientName}</td>
                        <td class="px-6 py-4">${new Date(s.date.seconds * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td class="px-6 py-4">${paymentDisplay}</td>
                        <td class="px-6 py-4 text-right font-semibold text-slate-800 dark:text-slate-100">${formatCurrency(s.total)}</td>
                        <td class="px-6 py-4 text-center">
                            <button data-order-id="${s.id}" class="view-details-btn text-brand-primary hover:underline">Detalhes</button>
                        </td>`;
                tbody.appendChild(r);
            });
        }
    };
    
    const applyFiltersAndFetchSales = () => {
        if (state.listeners.sales) state.listeners.sales();
        const dateFilter = c.querySelector('#filter-date').value;
        const paymentFilter = c.querySelector('#filter-payment').value;
        const vendedorFilter = isGerente ? c.querySelector('#filter-vendedor').value : null;

        let conditions = [where("storeId", "==", state.selectedStore.id)];
        if (isGerente) {
            if (vendedorFilter && vendedorFilter !== 'Todos') conditions.push(where("vendedor", "==", vendedorFilter));
        } else {
            conditions.push(where("vendedor", "==", state.loggedInUser.name));
        }
        if (paymentFilter && paymentFilter !== 'Todos') {
            conditions.push(where("paymentMethodTypes", "array-contains", paymentFilter));
        }
        if (dateFilter) {
            const startDate = Timestamp.fromDate(new Date(dateFilter + 'T00:00:00'));
            const endDate = Timestamp.fromDate(new Date(dateFilter + 'T23:59:59'));
            conditions.push(where("date", ">=", startDate), where("date", "<=", endDate));
        }
        
        state.listeners.sales = onSnapshot(query(collection(db, "sales"), ...conditions), (snapshot) => {
            let sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            sales.sort((a, b) => b.date.seconds - a.date.seconds);
            updateState({ db: {...state.db, sales }});
            renderTable(sales);
            if (!isGerente) updateDashboard(sales);
        }, (error) => {
            console.error("Erro ao buscar pedidos: ", error);
            c.querySelector('#orders-table-body').innerHTML = `<tr><td colspan="10" class="text-center p-8 text-red-500"><b>Erro ao carregar pedidos.</b><br><span class="text-xs">Pode ser necessário criar um índice no Firestore. Verifique o console de depuração para um link de criação.</span></td></tr>`;
        });
    };

    c.querySelector('#filter-form').addEventListener('submit', e => { e.preventDefault(); applyFiltersAndFetchSales(); });
    c.querySelector('#filter-form').addEventListener('reset', () => { setTimeout(applyFiltersAndFetchSales, 0); });
    
    applyFiltersAndFetchSales();

    c.querySelector('#orders-table-body').addEventListener('click', e => {
        const b = e.target.closest('.view-details-btn');
        if (b) {
            const order = state.db.sales.find(s => s.id == b.dataset.orderId);
            if (order) {
                const m = document.getElementById('order-details-modal');
                m.classList.remove('hidden');
                const itemsList = order.items.map(i => `<li>${i.productId ? '<i class="inline-block" data-lucide="package"></i> ' : ''}${i.name} (${formatCurrency(i.value)})</li>`).join('');
                const paymentDetails = Array.isArray(order.paymentMethods)
                    ? order.paymentMethods.map(p => {
                        let paymentString = `<li>${p.method}: ${formatCurrency(p.amount)}`;
                        if(p.installments) paymentString += ` (em ${p.installments})`;
                        paymentString += `</li>`;
                        return paymentString;
                    }).join('')
                    : `<li>${order.paymentMethod}: ${formatCurrency(order.total)}</li>`;
                let prizeDetails = '';
                if(order.prizeWon) prizeDetails = `<hr class="my-2 dark:border-slate-700"><p><strong>Prêmio Ganho:</strong> ${order.prizeWon}</p>`;
                
                m.innerHTML = `<div class="custom-card rounded-lg shadow-xl w-full max-w-lg p-6 m-4 fade-in"><div class="flex justify-between items-center border-b dark:border-slate-700 pb-3 mb-4"><h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Detalhes do Pedido</h2><button id="close-details-modal" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><i data-lucide="x" class="w-6 h-6"></i></button></div><div><p><strong>Cliente:</strong> ${order.clientName}</p><p><strong>Telefone:</strong> ${order.clientPhone || 'Não informado'}</p><p><strong>Data:</strong> ${new Date(order.date.seconds * 1000).toLocaleString('pt-BR')}</p><p><strong>Vendedor:</strong> ${order.vendedor}</p><hr class="my-2 dark:border-slate-700"><p><strong>Itens:</strong></p><ul class="list-disc list-inside ml-4">${itemsList}</ul><hr class="my-2 dark:border-slate-700"><p><strong>Pagamento:</strong></p><ul class="list-disc list-inside ml-4">${paymentDetails}</ul><p class="text-lg font-bold mt-2"><strong>Total:</strong> ${formatCurrency(order.total)}</p>${prizeDetails}</div></div>`;
                m.querySelector('#close-details-modal').addEventListener('click', () => m.classList.add('hidden'));
                window.lucide.createIcons();
            }
        }
    });
}