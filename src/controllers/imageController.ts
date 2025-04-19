import { Request, Response } from "express";
import {
  extractImagesFromWebsite,
  downloadImagesFromWebsite,
} from "../services/puppeteerService";

export const extractImages = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { websiteUrl } = req.body;

  if (!websiteUrl) {
    res.status(400).json({ error: "Missing 'websiteUrl' in request body" });
    return;
  }

  try {
    console.log(`API: Received request to extract images from: ${websiteUrl}`);
    const imageUrls = await extractImagesFromWebsite(websiteUrl);

    res.status(200).json({
      status: "success",
      websiteUrl,
      imageCount: imageUrls.length,
      images: imageUrls,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`API: Image extraction failed:`, errorMessage);
    res.status(500).json({
      status: "error",
      websiteUrl,
      error: errorMessage,
    });
  }
};

export const downloadImages = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { websiteUrl } = req.body;

  if (!websiteUrl) {
    res.status(400).json({ error: "Missing 'websiteUrl' in request body" });
    return;
  }

  try {
    console.log(`API: Received request to download images from: ${websiteUrl}`);
    const result = await downloadImagesFromWebsite(websiteUrl);

    res.status(200).json({
      status: "success",
      websiteUrl,
      imageCount: result.imageUrls.length,
      images: result.downloadedImages,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`API: Image download failed:`, errorMessage);
    res.status(500).json({
      status: "error",
      websiteUrl,
      error: errorMessage,
    });
  }
};
