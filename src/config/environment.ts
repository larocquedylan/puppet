import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export default {
  // GitHub credentials
  github: {
    username: process.env.username,
    password: process.env.password,
  },

  // Server configuration
  server: {
    port: process.env.PORT || 3000,
  },

  // Webhook configuration
  webhook: {
    clayUrl: process.env.CLAY_WEBHOOK_URL,
  },

  // OpenAI API Key
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
};
