import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { pool } from "../db";

dotenv.config();

const documents = [
  {
    title: "Return policy",
    topic: "returns",
    content:
      "You can return an item within 14 days of delivery if it is unused and in its original packaging. To start a return, tell us your order number and the reason. Once we approve the return, we refund you within 5 business days. Custom photo mugs cannot be returned unless they arrive damaged or defective.",
  },
  {
    title: "Damaged or wrong item",
    topic: "returns",
    content:
      "If your order arrives damaged or you received the wrong item, tell us within 48 hours of delivery and send a photo of the problem. We will send a free replacement or give you a full refund, whichever you prefer.",
  },
  {
    title: "Shipping times and fees",
    topic: "shipping",
    content:
      "We deliver across Lebanon. Delivery takes 1 to 3 business days to Tripoli and Beirut, and 3 to 5 business days to other areas. The shipping fee is 2 USD to Tripoli and 5 USD to the rest of Lebanon. Shipping is free for orders of 60 USD or more.",
  },
  {
    title: "Tracking your order",
    topic: "shipping",
    content:
      "Once your order ships, it gets a tracking number. To check your order, give us your order number and the email you used when ordering. The status can be processing (being prepared), shipped (with the courier), out for delivery (arriving today), or delivered.",
  },
  {
    title: "Payment methods",
    topic: "payment",
    content:
      "You can pay cash on delivery when the courier brings your order, or by bank transfer before we ship. We do not accept online card payments yet. Prices are in US dollars.",
  },
  {
    title: "Cancelling an order",
    topic: "orders",
    content:
      "You can cancel an order for free while its status is processing. Once the order has shipped, it can no longer be cancelled, but you can return it under our return policy. If you already paid, we refund you after the cancellation.",
  },
  {
    title: "Changing the shipping address",
    topic: "orders",
    content:
      "You can change the shipping address while the order status is processing. After the order has shipped, we cannot change the address, and you should contact the courier with your tracking number.",
  },
  {
    title: "Custom photo mugs",
    topic: "products",
    content:
      "Custom photo mugs are made to order and take 2 extra days to prepare before shipping. Send us a clear, high resolution photo. We show you a preview before printing. Because each mug is made for you, custom mugs cannot be returned unless they are damaged.",
  },
  {
    title: "Contact and support hours",
    topic: "support",
    content:
      "Our support team answers Monday to Saturday, from 9 AM to 6 PM. If this assistant cannot solve your problem, it can pass your request to the store owner, who replies within 1 business day.",
  },
];

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing in backend/.env");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: documents.map((d) => `${d.title}\n${d.content}`),
    config: { outputDimensionality: 768, taskType: "RETRIEVAL_DOCUMENT" },
  });

  const embeddings = response.embeddings ?? [];
  if (embeddings.length !== documents.length) {
    throw new Error(
      `Expected ${documents.length} embeddings, got ${embeddings.length}`
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM knowledge_base");

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const vector = `[${embeddings[i].values?.join(",")}]`;
      await client.query(
        "INSERT INTO knowledge_base (title, content, topic, embedding) VALUES ($1, $2, $3, $4::vector)",
        [doc.title, doc.content, doc.topic, vector]
      );
    }

    await client.query("COMMIT");
    console.log(`Saved ${documents.length} entries to knowledge_base`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seeding failed:", error.message);
  process.exit(1);
});