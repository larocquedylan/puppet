import { Router, Request, Response } from "express";
import OpenAI from "openai";
import config from "../config/environment"; // Adjust path if needed
import v0Routes from "./v0Routes";
import imageRoutes from "./imageRoutes";

const router = Router();

// Initialize OpenAI Client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// Mount v0 routes
router.use("/", v0Routes);

// Mount image routes
router.use("/", imageRoutes);

// New endpoint for Clay data
router.post("/clay-data", async (req: Request, res: Response) => {
  try {
    console.log("Received data from Clay:");
    const results = req.body.apifyResults || [];
    console.log(`Processing ${results.length} items from Apify.`);

    if (!config.openai.apiKey) {
      throw new Error("OpenAI API key is not configured.");
    }

    if (results.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No apifyResults found in the request body.",
      });
    }

    // Convert results to a string format suitable for the prompt
    const dataString = JSON.stringify(results, null, 2);

    // ---- OpenAI Prompting ----
    console.log("Sending data to OpenAI for processing...");
    const chatCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an assistant that cleans and summarizes website data extracted by Apify. Focus on key content like headings, main text, calls to action, and overall purpose. Remove boilerplate, navigation, and irrelevant details. Format the output as a concise summary suitable for generating marketing copy.",
        },
        {
          role: "user",
          content: `Please process the following website data:\n\n${dataString}`,
        },
      ],
      model: "gpt-3.5-turbo-0125", // Or your preferred model
    });

    const openAIResponse = chatCompletion.choices[0]?.message?.content;
    console.log("Received response from OpenAI:");
    console.log(openAIResponse);

    // TODO: Decide what to do with openAIResponse.
    // For now, just return success along with the response.

    res.status(200).json({
      status: "success",
      message: `Data received and processed by OpenAI. Items count: ${results.length}`,
      openaiSummary: openAIResponse, // Include the summary in the response
    });
  } catch (error) {
    console.error("Error processing Clay data or calling OpenAI:", error);
    // Check if it's an OpenAI API error for more specific feedback
    const errorMessage =
      error instanceof OpenAI.APIError
        ? error.message
        : error instanceof Error
        ? error.message
        : "An unknown error occurred.";
    const errorStatus = error instanceof OpenAI.APIError ? error.status : 500;

    res.status(errorStatus || 500).json({
      status: "error",
      message: "Failed to process data.",
      errorDetails: errorMessage,
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
