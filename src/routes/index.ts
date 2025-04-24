import { Router, Request, Response } from "express";
import v0Routes from "./v0Routes";

const router = Router();

// Mount v0 routes
router.use("/", v0Routes);

// Basic health check endpoint
router.get("/", (req: Request, res: Response) => {
  // Get current date and time in Vancouver
  const vancouverTime = new Date().toLocaleString("en-CA", {
    timeZone: "America/Vancouver",
  });
  res.send(
    `API is running in Vancouver, BC. Ready for /generate POST requests. Current time: ${vancouverTime}`
  );
});

export default router;
