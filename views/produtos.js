// js/views/produtos.js
// Renderiza a tela de produtos: listagem, adicionar, editar, remover.
// Base: estrutura e handlers extraídos do indexoficial.js e scriptoficial.js (lógica preservada) :contentReference[oaicite:7]{index=7} :contentReference[oaicite:8]{index=8}.

import { db } from '../firebase.js';
import { collection, addDoc, setDoc, doc, deleteDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { showToast } from '../utils.js';

export function renderProdutos(state) {
  const view = document.getElementById('produtos-view');
  if (!view) return;

  const form = view.querySelector('#add-product-form');
  const tableBody = view.querySelector('#products-table-body');
  let editingId = null;

  const resetForm = () => {
    form.reset();
    editingId = null;
    form.querySelector('button[type="submit"]').textContent = 'Adicionar Produto';
  };

  const renderTable = () => {
    tableBody.innerHTML = '';
    const products = state.db.products || [];
    if (products.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-500">Nenhum produto cadastrado.</td></tr>`;
      return;
    }
    products.forEach(p => {
      tableBody.innerHTML += `
        <tr class="bg-white/50 dark:bg-slate-900/50 border-b">
          <td class="px-6 py-4">${p.name}</td>
          <td class="px-6 py-4 text-center">${p.quantity}</td>
          <td class="px-6 py-4">${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(p.price)}</td>
          <td class="px-6 py-4 text-center">
            <button data-id="${p.id}" class="edit-product-btn text-amber-500 mr-2">Editar</button>
            <button data-id="${p.id}" class="delete-product-btn text-red-500">Remover</button>
          </td>
        </tr>
      `;
    });
  };

  // handlers (mantendo lógica de salvar com storeId)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.querySelector('#product-name').value.trim();
    const price = parseFloat(form.querySelector('#product-price').value) || 0;
    const quantity = parseInt(form.querySelector('#product-quantity').value) || 0;

    if (!name) return showToast('Nome do produto é obrigatório.', 'error');

    try {
      if (editingId) {
        await setDoc(doc(db, "products", editingId), { name, price, quantity, storeId: state.selectedStore.id }, { merge: true });
        showToast('Produto atualizado!', 'success');
      } else {
        await addDoc(collection(db, "products"), { name, price, quantity, storeId: state.selectedStore.id });
        showToast('Produto adicionado!', 'success');
      }
      // reload products for store
      const productsSnap = await getDocs(query(collection(db, "products"), where("storeId", "==", state.selectedStore.id)));
      state.db.products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTable();
      resetForm();
    } catch (error) {
      console.error("Erro produto:", error);
      showToast('Erro ao salvar produto.', 'error');
    }
  });

  tableBody.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-product-btn');
    const delBtn = e.target.closest('.delete-product-btn');
    if (editBtn) {
      const id = editBtn.dataset.id;
      const p = state.db.products.find(x => x.id === id);
      if (!p) return;
      form.querySelector('#product-name').value = p.name;
      form.querySelector('#product-price').value = p.price;
      form.querySelector('#product-quantity').value = p.quantity;
      editingId = id;
      form.querySelector('button[type="submit"]').textContent = 'Atualizar Produto';
    } else if (delBtn) {
      const id = delBtn.dataset.id;
      if (!confirm('Remover produto?')) return;
      try {
        await deleteDoc(doc(db, "products", id));
        state.db.products = state.db.products.filter(x => x.id !== id);
        renderTable();
        showToast('Produto removido!', 'success');
      } catch (error) {
        console.error("Erro ao remover produto:", error);
        showToast('Erro ao remover produto.', 'error');
      }
    }
  });

  renderTable();
}
