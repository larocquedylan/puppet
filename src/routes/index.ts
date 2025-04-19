import { Router, Request, Response } from "express";
import v0Routes from "./v0Routes";
import imageRoutes from "./imageRoutes";

const router = Router();

// Mount v0 routes
router.use("/", v0Routes);

// Mount image routes
router.use("/", imageRoutes);

// New endpoint for Clay data
router.post("/clay-data", (req: Request, res: Response) => {
  try {
    console.log("Received data from Clay:");
    // Assuming req.body has an apifyResults key containing an array
    const results = req.body.apifyResults || [];
    console.log(JSON.stringify(results, null, 2)); // Log the actual results array

    // TODO: Add logic here to process 'results' (e.g., call OpenAI)

    res.status(200).json({
      status: "success",
      message: `Data received successfully. Items count: ${results.length}`,
    });
  } catch (error) {
    console.error("Error processing Clay data:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to process data on the server.",
      errorDetails: error instanceof Error ? error.message : String(error),
    });
  }
});

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
