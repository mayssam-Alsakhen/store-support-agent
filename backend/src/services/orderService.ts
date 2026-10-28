import { pool } from "../db";

export type OrderDetails = {
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  city: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  trackingNumber: string | null;
  estimatedDeliveryDate: string | null;
  createdAt: Date;
  items: { name: string; quantity: number; unitPrice: number }[];
  history: { status: string; note: string | null; createdAt: Date }[];
};

export function formatOrderNumber(id: string | number): string {
  return `ORD-${id}`;
}

// Accepts "ORD-1001", "ord-1001" or "1001". Returns the id, or null if invalid.
export function parseOrderNumber(input: string): number | null {
  const match = input.trim().match(/^(?:ORD-)?(\d+)$/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : null;
}

// Returns the order id only if the order number AND the email match.
// A wrong number and a wrong email give the same result (null),
// so nobody can learn which part was wrong.
export async function verifyOrder(
  orderNumber: string,
  email: string
): Promise<string | null> {
  const id = parseOrderNumber(orderNumber);
  if (id === null) return null;

  const result = await pool.query(
    "SELECT id FROM orders WHERE id = $1 AND customer_email = lower(trim($2))",
    [id, email]
  );
  return result.rows.length > 0 ? String(result.rows[0].id) : null;
}

export async function getOrderDetails(
  orderId: string
): Promise<OrderDetails | null> {
  const orderResult = await pool.query(
    `SELECT id, status, payment_method, payment_status, city,
            subtotal, shipping_fee, total, tracking_number,
            to_char(estimated_delivery_date, 'YYYY-MM-DD') AS estimated_delivery_date,
            created_at
     FROM orders
     WHERE id = $1`,
    [orderId]
  );
  if (orderResult.rows.length === 0) return null;
  const order = orderResult.rows[0];

  const itemsResult = await pool.query(
    `SELECT p.name, oi.quantity, oi.unit_price
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1
     ORDER BY oi.id`,
    [orderId]
  );

  const historyResult = await pool.query(
    `SELECT status, note, created_at
     FROM order_events
     WHERE order_id = $1
     ORDER BY created_at, id`,
    [orderId]
  );

  return {
    orderNumber: formatOrderNumber(order.id),
    status: order.status,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    city: order.city,
    subtotal: Number(order.subtotal),
    shippingFee: Number(order.shipping_fee),
    total: Number(order.total),
    trackingNumber: order.tracking_number,
    estimatedDeliveryDate: order.estimated_delivery_date,
    createdAt: order.created_at,
    items: itemsResult.rows.map((row) => ({
      name: row.name,
      quantity: row.quantity,
      unitPrice: Number(row.unit_price),
    })),
    history: historyResult.rows.map((row) => ({
      status: row.status,
      note: row.note,
      createdAt: row.created_at,
    })),
  };
}