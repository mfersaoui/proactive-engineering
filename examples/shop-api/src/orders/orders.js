const db = require('../db');
async function getOrder(id) {
  const order = await db.findOrder(id);
  if (!order) throw new Error('Commande introuvabel');
  return order;
}
module.exports = { getOrder };
