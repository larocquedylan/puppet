# Clay Integration: Website Redesigner API

This custom API is designed to integrate with [Clay](https://clay.com/) via their HTTP API enrichment feature. Its purpose is to take a company's website URL and automatically generate a conceptual redesign using AI tools.

## What it Does

1.  **Receives a Website URL:** You provide the API with the URL of a company's website.
2.  **Generates a Redesign Concept:** Using backend tools (like Puppeteer for browsing and v0.dev for UI generation), the API creates a new visual concept for the website. It tries to use images from the original site for realism.
3.  **Sends Results Back to Clay:** Once the redesign is ready, the API sends a notification back to a pre-configured Clay webhook. This notification includes a link to the generated design concept.

## How it Works with Clay

This API is designed to work _asynchronously_. This means:

1.  When you call this API from Clay (using the HTTP API enrichment), you will _immediately_ get a response confirming the request was received (Status: `processing`, along with a unique `jobId`).
2.  The actual website redesign generation happens in the background. This can take some time depending on the complexity and the tools involved.
3.  Once the generation is complete (or if an error occurs), the API sends the final result (the URL of the generated design or an error message) to your configured Clay webhook URL. You'll need to set up a Clay workflow to listen for this webhook and update your Clay table accordingly.

## Setup Required (For the API Host)

- The API needs to be running on a server accessible from the internet.
- A tool like `ngrok` is typically needed during development to expose a local server to Clay.
- The `CLAY_WEBHOOK_URL` environment variable must be set on the server running this API. This tells the API where to send the results back to Clay.

## Using in Clay

1.  Add an "HTTP API" enrichment step in your Clay workflow.
2.  **Method:** `POST`
3.  **URL:** The public URL where this API is hosted, followed by `/generate` (e.g., `https://your-api-url.com/generate`).
4.  **Body:** Select "JSON" and provide the website URL from your Clay table data like this:
    ```json
    {
      "websiteUrl": "{{Your Website Column}}"
    }
    ```
5.  **Webhook Configuration:** Separately, configure a Clay webhook URL and provide it as the `CLAY_WEBHOOK_URL` environment variable when setting up _this_ API server. Your Clay table should have columns ready to receive the `jobId`, `status`, and `generatedUrl` (or `errorMessage`) sent by this API to the webhook.

This setup allows Clay to trigger the redesign process and receive the results asynchronously once the generation is finished.
