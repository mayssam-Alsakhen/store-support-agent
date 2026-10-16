import { pool } from "../db";

export async function getActiveProducts() {
  const result = await pool.query(
    "SELECT id, sku, name, price, stock_quantity FROM products WHERE is_active = true ORDER BY id"
  );
  return result.rows;
}