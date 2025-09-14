/**
 * Módulo de Utilitários.
 * Contém constantes globais e funções auxiliares usadas em toda a aplicação.
 */

export const PAGE_LIMIT = 15;
export const DEBUG = true; // Alterne para false em produção

/**
 * Formata um número como moeda brasileira (BRL).
 * @param {number} value - O valor a ser formatado.
 * @returns {string} A string formatada.
 */
export const formatCurrency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

/**
 * Formata um objeto de data ou timestamp do Firestore.
 * @param {Date|Timestamp} d - A data a ser formatada.
 * @returns {string} A data formatada.
 */
export const formatDate = d => {
    if (d && d.toDate) { // Timestamp do Firestore
        return d.toDate().toLocaleDateString('pt-BR');
    }
    return new Date(d).toLocaleDateString('pt-BR');
};

/**
 * Exibe uma notificação toast temporária.
 * @param {string} message - A mensagem a ser exibida.
 * @param {'success'|'error'|'info'} type - O tipo de toast.
 */
export const showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-brand-primary',
        error: 'bg-red-600',
        info: 'bg-slate-600'
    };
    toast.className = `text-white py-2 px-4 rounded-lg shadow-lg mb-2 fade-in ${colors[type]}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
};

// Outras funções de utilidade podem ser adicionadas aqui...