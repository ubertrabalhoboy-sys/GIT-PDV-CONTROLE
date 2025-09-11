// js/views/pedidos.js
// Render simples da lista de vendas/pedidos e ações de export/zerar.
// Base: trechos de relatorios / ações administrativas extraídos do scriptoficial.js (preservei lógica de "delete all sales" e relatórios) :contentReference[oaicite:9]{index=9}.

import { db } from '../firebase.js';
import { collection, getDocs, query, where, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast, formatCurrency, exportToCSV } from '../utils.js';

export function renderPedidos(state) {
  const view = document.getElementById('pedidos-view');
  if (!view) return;

  const listEl = view.querySelector('#sales-list');
  const btnExport = view.querySelector('#export-sales-btn');
  const btnDeleteAll = view.querySelector('#delete-all-sales-button');

  function renderList() {
    listEl.innerHTML = '';
    const sales = state.db.sales || [];
    if (sales.length === 0) {
      listEl.innerHTML = `<div class="p-6 text-center text-slate-500">Nenhuma venda encontrada.</div>`;
      return;
    }
    sales.forEach(s => {
      listEl.innerHTML += `
        <div class="custom-card p-4 mb-2 flex justify-between items-start">
          <div>
            <div class="font-semibold">${s.clientName || 'Cliente não informado'}</div>
            <div class="text-xs text-slate-500">${new Date(s.date.seconds * 1000).toLocaleString('pt-BR')}</div>
            <div class="text-sm mt-2">${s.items.map(i => i.name).join(', ')}</div>
          </div>
          <div class="text-right">
            <div class="font-bold">${formatCurrency(s.total)}</div>
            <div class="text-xs text-slate-500">${s.vendedor || ''}</div>
          </div>
        </div>
      `;
    });
  }

  btnExport?.addEventListener('click', () => exportToCSV(state.db.sales || [], `vendas_${state.selectedStore?.name || 'store'}`));

  btnDeleteAll?.addEventListener('click', async () => {
    if (!confirm(`TEM CERTEZA? Esta ação removerá PERMANENTEMENTE todas as vendas da loja "${state.selectedStore?.name}".`)) return;
    try {
      const q = query(collection(db, "sales"), where("storeId", "==", state.selectedStore.id));
      const salesSnapshot = await getDocs(q);
      if (salesSnapshot.empty) { showToast('Nenhuma venda para apagar.', 'success'); return; }
      const batch = writeBatch(db);
      salesSnapshot.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      state.db.sales = [];
      renderList();
      showToast(`Todas as vendas da loja "${state.selectedStore?.name}" foram zeradas!`, 'success');
    } catch (error) {
      console.error("Erro apagar vendas:", error);
      showToast('Ocorreu um erro ao zerar as vendas.', 'error');
    }
  });

  renderList();
}
