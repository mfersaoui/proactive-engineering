const { Pool } = require('pg');
const pool = new Pool();
async function findOrder(id) {
  const r = await pool.query('select * from orders where id = $1', [id]);
  return r.rows[0];
}
module.exports = { findOrder };
