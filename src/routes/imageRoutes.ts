import { Router } from "express";
import { extractImages, downloadImages } from "../controllers/imageController";

const router = Router();

// POST endpoint for extracting images from a website
router.post("/extract-images", extractImages);

// POST endpoint for downloading images from a website
router.post("/download-images", downloadImages);

export default router;
