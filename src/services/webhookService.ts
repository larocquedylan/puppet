import axios from "axios";

interface WebhookSuccessPayload {
  jobId: string;
  status: "completed";
  generatedUrl: string;
}

interface WebhookErrorPayload {
  jobId: string;
  status: "error";
  errorMessage: string;
}

type WebhookPayload = WebhookSuccessPayload | WebhookErrorPayload;

/**
 * Sends a notification to the specified webhook URL
 * @param webhookUrl The URL to send the notification to
 * @param payload The payload to send in the notification
 */
export async function notifyWebhook(
  webhookUrl: string,
  payload: WebhookPayload
): Promise<void> {
  try {
    console.log(
      `[${payload.jobId}] Sending ${payload.status} payload to webhook: ${webhookUrl}`
    );
    await axios.post(webhookUrl, payload);
    console.log(`[${payload.jobId}] Successfully sent webhook notification`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${payload.jobId}] Failed to notify webhook:`, errorMessage);
    throw error;
  }
}
