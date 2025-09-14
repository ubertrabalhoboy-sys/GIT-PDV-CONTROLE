/**
 * Módulo do Carrinho de Compras.
 * Gerencia o estado do pedido atual (itens, total).
 *
 * @file Lógica de gestão do carrinho de compras.
 * @summary Mantém o estado do pedido atual em memória.
 */

// Estado do carrinho é mantido em memória dentro deste módulo.
let currentOrder = [];

/**
 * Retorna uma cópia dos itens atuais no carrinho.
 * @returns {Array<object>} Os itens do pedido.
 */
export const getCart = () => [...currentOrder];

/**
 * Adiciona um item ao carrinho.
 * @param {object} item - O item a ser adicionado. Deve ter `name` e `value`.
 */
export const addItem = (item) => {
    currentOrder.push(item);
};

/**
 * Remove um item do carrinho pelo seu índice.
 * @param {number} index - O índice do item a ser removido.
 */
export const removeItem = (index) => {
    if (index >= 0 && index < currentOrder.length) {
        currentOrder.splice(index, 1);
    }
};

/**
 * Limpa todos os itens do carrinho.
 */
export const clearCart = () => {
    currentOrder = [];
};

/**
 * Calcula o valor total dos itens no carrinho.
 * @returns {number} O valor total.
 */
export const calculateTotal = () => {
    return currentOrder.reduce((sum, item) => sum + (item.value || 0), 0);
};