import express from "express";
import routes from "./routes";

// Initialize Express app
const app = express();

// Middleware for parsing JSON bodies
// Increase the limit to handle potentially large payloads from Clay/Apify
app.use(express.json({ limit: "50mb" }));

// Apply routes
app.use("/", routes);

export default app;
