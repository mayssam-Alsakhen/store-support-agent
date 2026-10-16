import type { Request, Response } from "express";
import { getActiveProducts } from "../services/productService";

export async function listProducts(_req: Request, res: Response) {
  try {
    const products = await getActiveProducts();
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load products" });
  }
}