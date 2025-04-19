import { Router } from "express";
import { generateDesign } from "../controllers/v0Controller";

const router = Router();

// POST endpoint for generating v0 designs
router.post("/generate", generateDesign);

export default router;
