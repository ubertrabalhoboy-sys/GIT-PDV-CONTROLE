import { db } from '../config/firebase.js';

/**
 * Busca os resumos de vendas gerados pelo backend.
 * @param {string} storeId - O ID da loja.
 * @param {Date} startDate - Data de início do período.
 * @param {Date} endDate - Data de fim do período.
 * @returns {Promise<object[]>}
 */
export async function getSalesSummaries(storeId, startDate, endDate) {
    try {
        const query = db.collection('summaries')
            .where('storeId', '==', storeId)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'desc');

        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao buscar resumos de vendas:", error);
        // Em caso de erro, pode ser uma boa ideia retornar um array vazio
        return [];
    }
}