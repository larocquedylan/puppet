import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export default {
  // GitHub credentials
  github: {
    username: process.env.GITHUB_USERNAME,
    password: process.env.GITHUB_PASSWORD,
  },

  // Server configuration
  server: {
    port: process.env.PORT || 3000,
  },

  // Webhook configuration
  webhook: {
    clayUrl: process.env.CLAY_WEBHOOK_URL,
  },
};
