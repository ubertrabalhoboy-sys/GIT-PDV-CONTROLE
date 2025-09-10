export const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-brand-primary' : 'bg-red-600';
    toast.className = `fixed bottom-5 right-5 ${bgColor} text-white py-2 px-4 rounded-lg shadow-lg z-[70] animate-bounce`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

export const showConfirmModal = (message, onConfirm) => {
    const modal = document.getElementById('confirm-modal');
    modal.querySelector('#confirm-modal-message').textContent = message;
    modal.classList.remove('hidden');

    const confirmBtn = modal.querySelector('#confirm-modal-confirm');
    const cancelBtn = modal.querySelector('#confirm-modal-cancel');

    const hide = () => {
        modal.classList.add('hidden');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', hide);
    };

    const handleConfirm = () => {
        onConfirm();
        hide();
    };

    confirmBtn.addEventListener('click', handleConfirm, { once: true });
    cancelBtn.addEventListener('click', hide, { once: true });
};

export const showMobileMenu = (show) => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (show) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
};

export const exportToCSV = (data, filename, formatCurrency) => {
    // This function remains the same as your original
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
                if (p.installments) {
                    paymentString += ` (em ${p.installments})`;
                }
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

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" +
        headers.join(",") + "\n" +
        rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};