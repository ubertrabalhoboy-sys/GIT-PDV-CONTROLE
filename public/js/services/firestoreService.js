import { db } from '../config/firebase.js';
import { getCurrentUser } from './authService.js';

/**
 * Busca documentos de uma coleção com filtros e paginação.
 * @param {string} collectionName - Nome da coleção.
 * @param {object[]} filters - Array de filtros. Ex: [{ field: 'storeId', op: '==', value: '123' }]
 * @param {object} orderBy - Campo e direção para ordenação. Ex: { field: 'createdAt', direction: 'desc' }
 * @param {number} limitPerPage - Número de itens por página.
 * @param {DocumentSnapshot} lastVisible - O último documento da página anterior para paginação.
 * @returns {Promise<{docs: object[], lastVisible: DocumentSnapshot}>}
 */
export async function getPaginatedData(collectionName, filters = [], orderBy = null, limitPerPage = 15, lastVisible = null) {
    let query = db.collection(collectionName);

    // Aplica filtros
    filters.forEach(filter => {
        query = query.where(filter.field, filter.op, filter.value);
    });

    // Aplica ordenação
    if (orderBy) {
        query = query.orderBy(orderBy.field, orderBy.direction);
    }

    // Aplica paginação
    if (lastVisible) {
        query = query.startAfter(lastVisible);
    }
    
    query = query.limit(limitPerPage);

    const snapshot = await query.get();
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return {
        docs,
        lastVisible: snapshot.docs[snapshot.docs.length - 1]
    };
}

/**
 * Busca um único documento por ID.
 * @param {string} collectionName - Nome da coleção.
 * @param {string} docId - ID do documento.
 * @returns {Promise<object|null>}
 */
export async function getDocumentById(collectionName, docId) {
    const doc = await db.collection(collectionName).doc(docId).get();
    if (doc.exists) {
        return { id: doc.id, ...doc.data() };
    }
    return null;
}

/**
 * Adiciona um novo documento a uma coleção.
 * Adiciona automaticamente o storeId do usuário logado.
 * @param {string} collectionName - Nome da coleção.
 * @param {object} data - Dados a serem salvos.
 * @returns {Promise<string>} - O ID do novo documento.
 */
export async function addDocument(collectionName, data) {
    const user = getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado.");

    const dataToSave = {
        ...data,
        storeId: user.storeId,
        createdAt: new Date(),
        createdBy: {
            uid: user.uid,
            name: user.name
        }
    };
    const docRef = await db.collection(collectionName).add(dataToSave);
    return docRef.id;
}

// ... Outras funções como updateDocument e deleteDocument podem ser adicionadas aqui.