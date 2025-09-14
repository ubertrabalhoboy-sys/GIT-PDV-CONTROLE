const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

/**
 * Exemplo de função agendada para agregar dados de vendas.
 * Executa todo dia à meia-noite.
 * Isso evita que o frontend tenha que ler milhares de vendas para gerar um relatório.
 */
exports.summarizeDailySales = functions.pubsub.schedule("every 24 hours").onRun(async (context) => {
  const firestore = admin.firestore();
  const storesSnapshot = await firestore.collection("stores").get();

  for (const storeDoc of storesSnapshot.docs) {
    const storeId = storeDoc.id;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfDay = new Date(yesterday.setHours(0, 0, 0, 0));
    const endOfDay = new Date(yesterday.setHours(23, 59, 59, 999));

    const salesSnapshot = await firestore.collection("sales")
      .where("storeId", "==", storeId)
      .where("createdAt", ">=", startOfDay)
      .where("createdAt", "<=", endOfDay)
      .get();

    if (salesSnapshot.empty) {
      continue;
    }

    let totalRevenue = 0;
    const salesBySeller = {};

    salesSnapshot.forEach(saleDoc => {
      const sale = saleDoc.data();
      totalRevenue += sale.total;
      if (!salesBySeller[sale.sellerId]) {
        salesBySeller[sale.sellerId] = 0;
      }
      salesBySeller[sale.sellerId] += sale.total;
    });

    const summary = {
      storeId,
      date: startOfDay,
      totalRevenue,
      totalOrders: salesSnapshot.size,
      salesBySeller,
      createdAt: new Date()
    };
    
    const summaryDateStr = startOfDay.toISOString().split('T')[0];
    await firestore.collection("summaries").doc(`${storeId}_${summaryDateStr}`).set(summary);
    console.log(`Successfully created summary for store ${storeId} on ${summaryDateStr}`);
  }

  return null;
});