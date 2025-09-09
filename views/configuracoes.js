import { doc, setDoc, getDocs, collection, query, where, writeBatch, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { db, auth, state, updateState } from '../main.js';
import { showToast, showConfirmModal, exportToCSV } from '../ui/utils.js';

export function renderConfiguracoes() {
    const c = document.getElementById('configuracoes-view');
    c.querySelector('#config-store-name').value = state.db.settings.storeName;
    c.querySelector('#owner-phone').value = state.db.settings.ownerPhone || '';
    c.querySelector('#meta-diaria').value = state.db.settings.goals?.daily || 0;
    c.querySelector('#meta-semanal').value = state.db.settings.goals?.weekly || 0;
    c.querySelector('#meta-mensal').value = state.db.settings.goals?.monthly || 0;
    
    const enableBonusCheckbox = c.querySelector('#enable-bonus');
    const bonusValueContainer = c.querySelector('#bonus-value-container');
    const bonusValueInput = c.querySelector('#bonus-value');

    enableBonusCheckbox.checked = state.db.settings.bonusSystem?.enabled ?? true;
    bonusValueInput.value = state.db.settings.bonusSystem?.value ?? 80;

    bonusValueContainer.classList.toggle('hidden', !enableBonusCheckbox.checked);
    enableBonusCheckbox.addEventListener('change', () => {
        bonusValueContainer.classList.toggle('hidden', !enableBonusCheckbox.checked);
    });
    
    const exportVendedorSelect = c.querySelector('#export-vendedor-select');
    exportVendedorSelect.innerHTML = '<option value="Todos">Todos os Vendedores</option>';
    const vendedores = state.db.users.filter(u => u.role === 'vendedor' && u.storeId === state.selectedStore.id).map(u => u.name);
    vendedores.forEach(name => {
        exportVendedorSelect.innerHTML += `<option value="${name}">${name}</option>`;
    });
    
    const handleExport = async (startDate, endDate, filename) => {
        const selectedVendedor = exportVendedorSelect.value;
        try {
            let conditions = [
                where("storeId", "==", state.selectedStore.id),
                where("date", ">=", startDate),
                where("date", "<=", endDate)
            ];
            const salesSnapshot = await getDocs(query(collection(db, "sales"), ...conditions));
            let salesToExport = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (selectedVendedor !== 'Todos') {
                salesToExport = salesToExport.filter(sale => sale.vendedor === selectedVendedor);
            }
            exportToCSV(salesToExport, filename);
        } catch (error) {
            console.error("Erro ao exportar vendas:", error);
            showToast('Erro ao buscar dados para exportação.', 'error');
        }
    };
    
    c.querySelector('#export-today-btn').addEventListener('click', () => {
        const todayStart = new Date(new Date().setHours(0,0,0,0));
        const todayEnd = new Date(new Date().setHours(23,59,59,999));
        const filename = `vendas_dia_${new Date().toISOString().split('T')[0]}_${exportVendedorSelect.value}`;
        handleExport(todayStart, todayEnd, filename);
    });

    c.querySelector('#export-week-btn').addEventListener('click', () => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(new Date(today.setDate(diff)).setHours(0, 0, 0, 0));
        const weekEnd = new Date(new Date(weekStart).setDate(weekStart.getDate() + 6));
        weekEnd.setHours(23,59,59,999);
        const filename = `vendas_semana_${new Date().toISOString().split('T')[0]}_${exportVendedorSelect.value}`;
        handleExport(weekStart, weekEnd, filename);
    });

    c.querySelector('#export-month-btn').addEventListener('click', () => {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        monthEnd.setHours(23,59,59,999);
        const filename = `vendas_mes_${today.getFullYear()}_${today.getMonth() + 1}_${exportVendedorSelect.value}`;
        handleExport(monthStart, monthEnd, filename);
    });

    c.querySelector('#export-range-btn').addEventListener('click', () => {
        const startDateInput = c.querySelector('#start-date').value;
        const endDateInput = c.querySelector('#end-date').value;
        if (!startDateInput || !endDateInput) return showToast('Por favor, selecione data de início e fim.', 'error');
        const startDate = new Date(startDateInput + 'T00:00:00');
        const endDate = new Date(endDateInput + 'T23:59:59');
        const filename = `vendas_de_${startDateInput}_a_${endDateInput}_${exportVendedorSelect.value}`;
        handleExport(startDate, endDate, filename);
    });

    const updateUsersList=()=>{
        const list=c.querySelector('#users-list');
        list.innerHTML='';
        const usersInStore = state.db.users.filter(u => u.storeId === state.selectedStore.id || u.role === 'superadmin');
        if(usersInStore.length === 0) return list.innerHTML = '<p class="text-slate-500 text-sm text-center">Nenhum usuário cadastrado para esta loja.</p>';

        usersInStore.forEach(v=>{
            const roleClass = v.role === 'superadmin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' : v.role === 'gerente' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            const roleText = v.role.charAt(0).toUpperCase() + v.role.slice(1);
            list.innerHTML+=`<li class="flex justify-between items-center bg-slate-100 dark:bg-slate-700 p-2 rounded-md">
                <div>
                    <span>${v.name}</span>
                    <span class="text-xs ml-2 px-2 py-0.5 rounded-full font-medium ${roleClass}">${roleText}</span>
                </div>
                <button data-userid="${v.id}" data-username="${v.name}" class="remove-user-btn text-red-500 hover:text-red-700 ${v.name === state.loggedInUser.name || v.role === 'superadmin' ? 'hidden' : ''}">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </li>`;
        });
        window.lucide.createIcons();
    };
    updateUsersList();

    c.querySelector('#add-user-form').addEventListener('submit', async e => {
        e.preventDefault();
        const n = c.querySelector('#user-name').value.trim();
        const p = c.querySelector('#user-password').value;
        const isManager = c.querySelector('#create-as-manager').checked;
        const role = isManager ? 'gerente' : 'vendedor';
        if (!n || !p) return showToast('Nome e senha são obrigatórios.', 'error');
        if (state.db.users.some(u => u.name.toLowerCase() === n.toLowerCase())) return showToast('Nome de usuário já existe.', 'error');
        
        const email = `${n.toLowerCase().replace(/\s+/g, '')}@pdv-app.com`;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, p);
            await setDoc(doc(db, "users", userCredential.user.uid), { name: n, role: role, storeId: state.selectedStore.id });
            showToast('Usuário cadastrado com sucesso!', 'success');
            e.target.reset();
        } catch (error) {
            console.error("Erro ao criar usuário:", error);
            if (error.code === 'auth/email-already-in-use') showToast('Este nome de usuário já está em uso.', 'error');
            else if (error.code === 'auth/weak-password') showToast('A senha deve ter no mínimo 6 caracteres.', 'error');
            else showToast('Erro ao cadastrar usuário.', 'error');
        }
    });

    c.querySelector('#users-list').addEventListener('click', e => {
        const removeBtn = e.target.closest('.remove-user-btn');
        if (removeBtn) {
            const { userid, username } = removeBtn.dataset;
            showConfirmModal(`Tem certeza que deseja remover o usuário "${username}"?`, async () => {
               try {
                   await deleteDoc(doc(db, "users", userid));
                   showToast(`Usuário "${username}" removido.`, 'success');
               } catch (error) { showToast('Erro ao remover usuário.', 'error'); }
            });
        }
    });

    c.querySelector('#save-settings-button').addEventListener('click', async ()=> {
        const newStoreName = c.querySelector('#config-store-name').value;
        const newOwnerPhone = c.querySelector('#owner-phone').value;
        try {
            await setDoc(doc(db, "settings", state.selectedStore.id), { storeName: newStoreName, ownerPhone: newOwnerPhone }, { merge: true });
            await setDoc(doc(db, "stores", state.selectedStore.id), { name: newStoreName }, { merge: true });
            showToast('Configurações da loja salvas!', 'success');
        } catch (error) { showToast('Erro ao salvar configurações da loja.', 'error'); }
    });

    c.querySelector('#save-goals-button').addEventListener('click', async () => {
        const newGoals = {
            daily: parseFloat(c.querySelector('#meta-diaria').value) || 0,
            weekly: parseFloat(c.querySelector('#meta-semanal').value) || 0,
            monthly: parseFloat(c.querySelector('#meta-mensal').value) || 0,
        };
        const newBonusSystem = {
             enabled: c.querySelector('#enable-bonus').checked,
             value: parseFloat(c.querySelector('#bonus-value').value) || 80,
        };
        try {
            await setDoc(doc(db, "settings", state.selectedStore.id), { goals: newGoals, bonusSystem: newBonusSystem }, { merge: true });
            showToast('Metas e bônus salvos com sucesso!', 'success');
        } catch(error) {
            showToast('Erro ao salvar metas e bônus.', 'error');
        }
    });
    
    c.querySelector('#delete-all-sales-button').addEventListener('click', async () => {
        showConfirmModal(`TEM CERTEZA? Esta ação removerá PERMANENTEMENTE todas as vendas da loja "${state.selectedStore.name}".`, async () => {
            try {
                const q = query(collection(db, "sales"), where("storeId", "==", state.selectedStore.id));
                const salesSnapshot = await getDocs(q);
                if (salesSnapshot.empty) { showToast('Nenhuma venda para apagar.', 'success'); return; }
                const batch = writeBatch(db);
                salesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                showToast(`Todas as vendas da loja "${state.selectedStore.name}" foram zeradas!`, 'success');
            } catch (error) { showToast('Ocorreu um erro ao zerar as vendas.', 'error'); }
        });
    });
    
    // Lógica para gerenciar lojas (apenas para superadmin)
    const manageStoresSection = c.querySelector('#manage-stores-section');
    if (state.loggedInUser.role === 'superadmin') {
        manageStoresSection.classList.remove('hidden');
        // ... (resto do código de gerenciamento de lojas, prêmios, etc.)
    } else {
        manageStoresSection.classList.add('hidden');
    }
}