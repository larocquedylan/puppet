import app from "./app";
import config from "./config/environment";

const PORT = config.server.port;

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(
    `Ready to accept POST requests at http://localhost:${PORT}/generate`
  );

  if (!config.webhook.clayUrl) {
    console.warn("*****************************************************");
    console.warn("Warning: CLAY_WEBHOOK_URL environment variable not set!");
    console.warn("The API will accept jobs but cannot notify Clay.");
    console.warn("*****************************************************");
  } else {
    console.log(`Configured to notify Clay at: ${config.webhook.clayUrl}`);
  }

  console.log(
    "Ensure ngrok (or similar) is running and pointed to this port for Clay integration."
  );
});
