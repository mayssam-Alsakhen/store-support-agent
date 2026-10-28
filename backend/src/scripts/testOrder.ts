import { verifyOrder, getOrderDetails } from "../services/orderService";
import { pool } from "../db";

async function main() {
  const [orderNumber, email] = process.argv.slice(2);
  if (!orderNumber || !email) {
    throw new Error(
      "Usage: npx tsx src/scripts/testOrder.ts <order number> <email>"
    );
  }

  const orderId = await verifyOrder(orderNumber, email);
  if (orderId === null) {
    console.log("No order found with that number and email.");
    return;
  }

  const details = await getOrderDetails(orderId);
  console.dir(details, { depth: null });
}

main()
  .catch((error) => console.error("Test failed:", error.message))
  .finally(() => pool.end());