// js/utils.js
export const formatCurrency = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export const formatDate = d => {
    if (d && d.toDate) return d.toDate().toLocaleDateString('pt-BR');
    return new Date(d).toLocaleDateString('pt-BR');
};

export const showToast = (m, t = 'success') => {
    const e = document.createElement('div');
    e.className = `fixed bottom-5 right-5 ${t === 'success' ? 'bg-brand-primary' : 'bg-red-600'} text-white py-2 px-4 rounded-lg shadow-lg z-[70] animate-bounce`;
    e.textContent = m;
    document.body.appendChild(e);
    setTimeout(() => e.remove(), 3000);
};

export const showConfirmModal = (m, onConfirm) => {
    const M = document.getElementById('confirm-modal');
    M.querySelector('#confirm-modal-message').textContent = m;
    M.classList.remove('hidden');
    const c = M.querySelector('#confirm-modal-confirm'), n = M.querySelector('#confirm-modal-cancel');
    const hide = () => { M.classList.add('hidden'); c.removeEventListener('click', h); n.removeEventListener('click', k); };
    const h = () => { onConfirm(); hide(); };
    const k = () => hide();
    c.addEventListener('click', h, { once: true });
    n.addEventListener('click', k, { once: true });
};

// Simples export CSV (preservei a lógica original)
export function exportToCSV(data, filename) {
    if (data.length === 0) {
        showToast('Nenhuma venda encontrada para exportar.', 'error');
        return;
    }
    const headers = [
        "Data da Compra", "ID da Venda", "Nome do Cliente", "Telefone do Cliente", "Vendedor",
        "Itens Vendidos", "Forma de Pagamento", "Total da Venda", "Bônus da Venda"
    ];

    const formatItemsForCSV = (items) => {
        if (!Array.isArray(items)) return '';
        return items.map(item =>
            `${item.name} (Valor: ${formatCurrency(item.value)}, Troca: ${item.exchange})`
        ).join(' | ');
    };

    const formatPaymentsForCSV = (payments) => {
        if (Array.isArray(payments) && payments.length > 0) {
            return payments.map(p => {
                let paymentString = `${p.method}: ${formatCurrency(p.amount)}`;
                if (p.installments) paymentString += ` (em ${p.installments})`;
                return paymentString;
            }).join(' | ');
        }
        return payments || '';
    };

    const rows = data.map(sale => [
        new Date(sale.date.seconds * 1000).toLocaleString('pt-BR'),
        sale.id,
        sale.clientName,
        sale.clientPhone || '',
        sale.vendedor,
        formatItemsForCSV(sale.items),
        formatPaymentsForCSV(sale.paymentMethods || sale.paymentMethod),
        (sale.total || 0).toFixed(2).replace('.', ','),
        sale.bonus
    ]);

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"
        + headers.join(",") + "\n"
        + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
