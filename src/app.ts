import express from "express";
import routes from "./routes";

// Initialize Express app
const app = express();

// Middleware for parsing JSON bodies
app.use(express.json());

// Apply routes
app.use("/", routes);

export default app;
