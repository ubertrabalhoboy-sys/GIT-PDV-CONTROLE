// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Função chamada pelo cliente DEPOIS que o login com senha é bem-sucedido.
 * Ela busca o 'storeId' do usuário no banco de dados e o adiciona
 * como uma permissão especial (Custom Claim) no token de autenticação.
 * É esse 'storeId' que as Regras de Segurança do Firestore usarão para
 * garantir que o usuário só veja os dados da sua própria loja.
 */
exports.setStoreClaim = functions.https.onCall(async (data, context) => {
  // Verifica se o usuário que chamou a função está realmente autenticado.
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "A chamada deve ser feita por um usuário autenticado.",
    );
  }

  try {
    const userId = context.auth.uid;
    const userDoc = await admin.firestore().collection("users").doc(userId).get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Usuário não encontrado no Firestore.");
    }

    const storeId = userDoc.data().storeId;
    const userRole = userDoc.data().role; // Pega a role (vendedor, gerente)

    if (!storeId) {
        throw new functions.https.HttpsError("permission-denied", "Usuário não possui uma loja associada.");
    }

    // Define as permissões ('storeId' e 'role') no token do usuário.
    await admin.auth().setCustomUserClaims(userId, { storeId: storeId, role: userRole });

    return {
      status: "success",
      message: `Permissão da loja ${storeId} e função ${userRole} adicionada ao usuário ${userId}.`,
    };
  } catch (error) {
    console.error("Erro ao definir a permissão da loja:", error);
    throw new functions.https.HttpsError("internal", "Erro interno ao processar a solicitação.");
  }
});