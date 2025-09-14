/**
 * Camada de Acesso a Dados (Data Access Layer) para o Firestore.
 * Abstrai todas as chamadas diretas ao Firestore, como buscas, criações e atualizações.
 * Utiliza o módulo de paginação para buscas em coleções grandes.
 *
 * @file API para interagir com o Firestore.
 * @summary Centraliza todas as operações do Firestore, garantindo consistência e
 * implementando a lógica de paginação e transações.
 * @description
 * - SYSTEM SPEC: multi-store isolation; roles (Vendedor, Gerente, Super Admin);
 * - limit DB reads to pages of 15; transaction/batch for sales.
 */
import { db } from './firebaseConfig.js';
import {
    collection, getDocs, onSnapshot, doc, addDoc, deleteDoc, setDoc, query, where, writeBatch,
    Timestamp, getDoc, updateDoc, increment, limit, startAfter, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { PAGE_LIMIT, DEBUG } from './utils.js';

// --- Funções Genéricas e de Configuração ---

export const getStores = async () => {
    const storesSnapshot = await getDocs(query(collection(db, "stores")));
    return storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getSettings = async (storeId) => {
    if (!storeId) return null;
    const settingsSnap = await getDoc(doc(db, "settings", storeId));
    return settingsSnap.exists() ? settingsSnap.data() : null;
};

// --- Funções de Usuário ---

export const getUserProfile = async (uid) => {
    const userSnap = await getDoc(doc(db, "users", uid));
    return userSnap.exists() ? { id: uid, ...userSnap.data() } : null;
};

export const getUsersForStore = async (storeId, onlySuperAdmin = false) => {
    let q;
    if (onlySuperAdmin) {
        q = query(collection(db, "users"), where("role", "==", "superadmin"));
    } else {
        q = storeId
            ? query(collection(db, "users"), where("storeId", "==", storeId))
            : query(collection(db, "users"));
    }
    const snapshot = await getDocs(q);
    
    // Incluir superadmin em todas as buscas para garantir que ele possa logar em qualquer loja.
    const superAdminQuery = query(collection(db, "users"), where("role", "==", "superadmin"));
    const superAdminSnapshot = await getDocs(superAdminQuery);
    
    const usersMap = new Map();
    snapshot.docs.forEach(doc => usersMap.set(doc.id, { id: doc.id, ...doc.data() }));
    superAdminSnapshot.docs.forEach(doc => usersMap.set(doc.id, { id: doc.id, ...doc.data() }));

    return Array.from(usersMap.values());
};

export const getInitialAdminUser = async () => {
    const q = query(collection(db, "users"), where("role", "==", "superadmin"), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const adminDoc = snapshot.docs[0];
    return { id: adminDoc.id, ...adminDoc.data() };
};

// --- Funções Paginated ---

/**
 * Busca uma página de documentos de uma coleção, com filtros e ordenação.
 * @param {string} collectionName - Nome da coleção (ex: 'products', 'clients').
 * @param {string} storeId - ID da loja para filtrar os documentos.
 * @param {object} [options={}] - Opções de paginação e filtro.
 * @param {DocumentSnapshot} [options.lastVisible=null] - O último documento da página anterior para `startAfter`.
 * @param {string} [options.orderByField='name'] - Campo para ordenação.
 * @returns {Promise<{items: Array, lastVisible: DocumentSnapshot|null}>} - Um objeto com os itens e o cursor para a próxima página.
 */
async function getPaginatedData(collectionName, storeId, options = {}) {
    const { lastVisible = null, orderByField = 'name' } = options;
    const constraints = [
        where("storeId", "==", storeId),
        orderBy(orderByField),
        limit(PAGE_LIMIT)
    ];

    if (lastVisible) {
        constraints.push(startAfter(lastVisible));
    }

    const q = query(collection(db, collectionName), ...constraints);
    const documentSnapshots = await getDocs(q);

    const items = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const newLastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1] || null;

    return { items, lastVisible: newLastVisible };
}

export const getProductsPaginated = (storeId, options) => getPaginatedData('products', storeId, { ...options, orderByField: 'name' });
export const getClientsPaginated = (storeId, options) => getPaginatedData('clients', storeId, { ...options, orderByField: 'name' });
export const getSalesPaginated = (storeId, options) => getPaginatedData('sales', storeId, { ...options, orderByField: 'date' });


// --- Funções CRUD ---

// Produtos
export const addProduct = (productData) => addDoc(collection(db, "products"), productData);
export const updateProduct = (productId, productData) => updateDoc(doc(db, "products", productId), productData);
export const deleteProduct = (productId) => deleteDoc(doc(db, "products", productId));

// Clientes
export const addClient = (clientData) => addDoc(collection(db, "clients"), clientData);
export const updateClient = (clientId, clientData) => updateDoc(doc(db, "clients", clientId), clientData);
export const deleteClient = (clientId) => deleteDoc(doc(db, "clients", clientId));

// Vendas
/**
 * Cria uma nova venda e decrementa o estoque dos produtos em uma única operação atômica.
 * @param {object} saleData - O objeto de dados da venda.
 * @returns {Promise<DocumentReference>} A referência ao novo documento de venda.
 * @throws {Error} Se a atualização do estoque ou a criação da venda falhar.
 */
export async function createSale(saleData) {
    const batch = writeBatch(db);

    // 1. Decrementar o estoque para cada produto do carrinho que vem do estoque
    const itemsToDecrement = saleData.items.filter(item => item.productId);
    itemsToDecrement.forEach(item => {
        const productRef = doc(db, "products", item.productId);
        batch.update(productRef, { quantity: increment(-1) });
    });

    // 2. Criar o novo documento de venda
    const newSaleRef = doc(collection(db, "sales"));
    batch.set(newSaleRef, saleData);

    // 3. Executar a operação em lote
    await batch.commit();
    if (DEBUG) console.log("Batch write successful for sale and stock update.");

    return newSaleRef;
}