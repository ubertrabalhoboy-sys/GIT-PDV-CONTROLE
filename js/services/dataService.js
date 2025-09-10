import { collection, getDocs, onSnapshot, doc, addDoc, deleteDoc, setDoc, query, where, writeBatch, Timestamp, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from './firebase.js';

// --- Read Operations (Get and Listen) ---

export const getStores = () => getDocs(query(collection(db, "stores")));
export const getSettings = (storeId) => getDoc(doc(db, "settings", storeId));
export const getUsersForStore = (storeId) => {
    const usersQuery = query(collection(db, "users"), where("storeId", "==", storeId));
    const superAdminQuery = query(collection(db, "users"), where("role", "==", "superadmin"));
    return Promise.all([getDocs(usersQuery), getDocs(superAdminQuery)]);
};

/**
 * Listens to a Firestore collection and handles updates, with added error logging.
 * @param {string} collectionName The name of the collection.
 * @param {Function} onNext Callback function for successful data snapshots.
 * @param {Function} onError Callback function for errors.
 * @param {Array} conditions Firestore query conditions.
 * @returns {Function} The unsubscribe function from Firestore.
 */
export const listenToCollection = (collectionName, onNext, onError, conditions = []) => {
    console.log(`[dataService] Subscribing to collection: "${collectionName}" with conditions:`, conditions.map(c => c.toString()));
    const q = query(collection(db, collectionName), ...conditions);
    // The second argument to onSnapshot is the error handler, which we now pass to our onError callback.
    return onSnapshot(q, onNext, onError);
};


// --- Write Operations ---

export const createInitialStore = async (storeName) => {
    const storeRef = await addDoc(collection(db, "stores"), { name: storeName });
    await setDoc(doc(db, "settings", storeRef.id), {
        storeName: storeName,
        goals: { daily: 150, weekly: 1000, monthly: 4000 },
        bonusSystem: { enabled: true, value: 80 },
        bonusWheel: { enabled: false, prizes: [], minValue: 0 },
        ownerPhone: ''
    });
    return storeRef;
};

export const createDefaultSettings = (storeId, storeName) => {
    const defaultSettings = {
        storeName: storeName,
        goals: { daily: 150, weekly: 1000, monthly: 4000 },
        bonusSystem: { enabled: true, value: 80 },
        bonusWheel: { enabled: false, prizes: [], minValue: 0 },
        ownerPhone: ''
    };
    return setDoc(doc(db, "settings", storeId), defaultSettings);
};

export const finalizeSale = (saleData) => {
    const batch = writeBatch(db);
    const itemsToDecrement = saleData.items.filter(item => item.productId);

    itemsToDecrement.forEach(item => {
        const productRef = doc(db, "products", item.productId);
        batch.update(productRef, { quantity: increment(-1) });
    });

    const newSaleRef = doc(collection(db, "sales"));
    batch.set(newSaleRef, { ...saleData, date: Timestamp.now() });

    return batch.commit().then(() => newSaleRef.id);
};

export const updateSaleWithPrize = (saleId, prizeName) => {
    return updateDoc(doc(db, "sales", saleId), { prizeWon: prizeName });
};

export const saveDocument = (collectionName, docId, data, merge = false) => {
    return setDoc(doc(db, collectionName, docId), data, { merge });
};

export const addDocument = (collectionName, data) => {
    return addDoc(collection(db, collectionName), data);
};

export const deleteDocument = (collectionName, docId) => {
    return deleteDoc(doc(db, collectionName, docId));
};

export const deleteAllSalesForStore = async (storeId) => {
    const q = query(collection(db, "sales"), where("storeId", "==", storeId));
    const salesSnapshot = await getDocs(q);
    if (salesSnapshot.empty) return;

    const batch = writeBatch(db);
    salesSnapshot.docs.forEach(d => batch.delete(d.ref));
    return batch.commit();
};

export const deleteStoreAndAssociatedData = async (storeId) => {
    const batch = writeBatch(db);
    
    // Queries for associated data
    const salesQuery = query(collection(db, "sales"), where("storeId", "==", storeId));
    const usersQuery = query(collection(db, "users"), where("storeId", "==", storeId));
    const productsQuery = query(collection(db, "products"), where("storeId", "==", storeId));
    const clientsQuery = query(collection(db, "clients"), where("storeId", "==", storeId));
    
    const [salesSnapshot, usersSnapshot, productsSnapshot, clientsSnapshot] = await Promise.all([
        getDocs(salesQuery),
        getDocs(usersQuery),
        getDocs(productsQuery),
        getDocs(clientsQuery)
    ]);

    // Delete associated data
    salesSnapshot.docs.forEach(d => batch.delete(d.ref));
    usersSnapshot.docs.forEach(d => batch.delete(d.ref));
    productsSnapshot.docs.forEach(d => batch.delete(d.ref));
    clientsSnapshot.docs.forEach(d => batch.delete(d.ref));

    // Delete settings and the store itself
    batch.delete(doc(db, "settings", storeId));
    batch.delete(doc(db, "stores", storeId));

    return batch.commit();
};
