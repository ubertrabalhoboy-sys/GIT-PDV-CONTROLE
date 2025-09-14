/**
 * Módulo de Vendas e Pedidos.
 * Orquestra o fluxo de caixa (Caixa) e a visualização de pedidos históricos.
 *
 * @file Lógica para registo e visualização de vendas.
 * @summary Gere o processo de checkout, incluindo pagamento, stock e envio de recibos.
 * @description
 * - SYSTEM SPEC: Stock decrement with batched Firestore writes; multi-payment;
 * - installment logic; troco calculation; optional prize roulette; send receipt link to WhatsApp.
 */

import { getCart, addItem, removeItem, clearCart, calculateTotal } from './cart.js';
import { getCurrentUser, getSelectedStore } from './auth.js';
import { getProductsPaginated, createSale } from './firebaseApi.js';
import { formatCurrency, showToast } from './utils.js';
import { showAndSpinRoulette } from './roulette.js';

// ... (Rest of the files will be generated in the next turn)