import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { generateV0Design } from "../services/puppeteerService";
import config from "../config/environment";
import { notifyWebhook } from "../services/webhookService";
export const generateDesign = (req: Request, res: Response): void => {
  const { websiteUrl } = req.body;
  const CLAY_WEBHOOK_URL = config.webhook.clayUrl;

  if (!websiteUrl) {
    console.warn("API: Received request without 'websiteUrl'.");
    res.status(400).json({ error: "Missing 'websiteUrl' in request body" });
    return;
  }

  if (!CLAY_WEBHOOK_URL) {
    console.error("API: CLAY_WEBHOOK_URL is not configured on the server.");
    res
      .status(500)
      .json({ error: "Server configuration error: Webhook URL not set." });
    return;
  }

  const jobId = uuidv4();
  console.log(`[${jobId}] API: Received request for: ${websiteUrl}`);

  // Construct the dynamic prompt for redesign
  const prompt = `1. Redesign this website: ${websiteUrl}. Use the actual images from the original website where appropriate.`;
  console.log(`[${jobId}] API: Using prompt: "${prompt}"`);

  // Start the background task asynchronously
  processPuppeteerJobInBackground(prompt, jobId);
  console.log(`[${jobId}] API: Handed off job to background processor.`);

  // Immediately respond with 202 Accepted and the Job ID
  res.status(202).json({ status: "processing", jobId: jobId });
};

async function processPuppeteerJobInBackground(
  prompt: string,
  jobId: string
): Promise<void> {
  console.log(`[${jobId}] Starting Puppeteer job for prompt: "${prompt}"`);
  const CLAY_WEBHOOK_URL = config.webhook.clayUrl;

  if (!CLAY_WEBHOOK_URL) {
    console.error(
      `[${jobId}] FATAL: CLAY_WEBHOOK_URL is not defined. Cannot notify Clay.`
    );
    return;
  }

  try {
    const generatedUrl = await generateV0Design(prompt);
    console.log(`[${jobId}] Puppeteer job succeeded. URL: ${generatedUrl}`);

    await notifyWebhook(CLAY_WEBHOOK_URL, {
      jobId,
      status: "completed",
      generatedUrl,
    });
    console.log(`[${jobId}] Successfully notified Clay webhook.`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${jobId}] Puppeteer job failed:`, errorMessage);

    try {
      await notifyWebhook(CLAY_WEBHOOK_URL, {
        jobId,
        status: "error",
        errorMessage,
      });
      console.log(
        `[${jobId}] Successfully notified Clay webhook about the error.`
      );
    } catch (callbackError) {
      const cbErrorMessage =
        callbackError instanceof Error
          ? callbackError.message
          : String(callbackError);
      console.error(
        `[${jobId}] FATAL: Failed to notify Clay webhook about the error:`,
        cbErrorMessage
      );
      console.error(`[${jobId}] Original error details:`, errorMessage);
    }
  }
}
