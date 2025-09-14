import { db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, query, where, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function getStores() {
    const storesSnapshot = await getDocs(query(collection(db, "stores")));
    return storesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getUserProfile(uid) {
    if (!uid) return null;
    const userSnap = await getDoc(doc(db, "users", uid));
    return userSnap.exists() ? { id: uid, ...userSnap.data() } : null;
}

export async function getInitialAdminUser() {
    const q = query(collection(db, "users"), where("role", "==", "superadmin"), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const adminDoc = snapshot.docs[0];
    return { id: adminDoc.id, ...adminDoc.data() };
}

export async function getUsersForStore(storeId) {
    if (!storeId) return [];
    const q = query(collection(db, "users"), where("storeId", "==", storeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}