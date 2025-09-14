/**
 * Módulo de Paginação.
 * Abstrai a lógica de construção de queries paginadas para o Firestore.
 *
 * @file Abstração para queries paginadas.
 * @summary Fornece uma maneira reutilizável de construir queries com cursores e limites.
 * @description
 * - SYSTEM SPEC: limit DB reads to pages of 15.
 */

import { query, orderBy, limit, startAfter, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { PAGE_LIMIT } from './utils.js';

/**
 * Constrói uma query do Firestore com suporte para paginação e filtros.
 * @param {CollectionReference} collectionRef - A referência da coleção do Firestore.
 * @param {object} options - Opções para a query.
 * @param {string} options.storeId - O ID da loja para filtrar os dados.
 * @param {string} [options.orderByField='name'] - O campo pelo qual ordenar.
 * @param {string} [options.orderDirection='asc'] - A direção da ordenação ('asc' ou 'desc').
 * @param {DocumentSnapshot} [options.cursor=null] - O cursor (último documento da página anterior) para `startAfter`.
 * @param {Array} [options.filters=[]] - Filtros adicionais no formato [{field, operator, value}].
 * @returns {Query} A query construída do Firestore.
 */
export function buildPaginatedQuery(collectionRef, options) {
    const {
        storeId,
        orderByField = 'name',
        orderDirection = 'asc',
        cursor = null,
        filters = []
    } = options;

    const constraints = [
        where("storeId", "==", storeId),
        orderBy(orderByField, orderDirection),
        limit(PAGE_LIMIT)
    ];

    if (cursor) {
        constraints.push(startAfter(cursor));
    }

    filters.forEach(filter => {
        constraints.push(where(filter.field, filter.operator, filter.value));
    });

    return query(collectionRef, ...constraints);
}