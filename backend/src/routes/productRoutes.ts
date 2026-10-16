import { Router } from "express";
import { listProducts } from "../controllers/productController";

const router = Router();

router.get("/", listProducts);

export default router;