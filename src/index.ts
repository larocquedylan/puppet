import puppeteer, { Page } from "puppeteer";
import dotenv from "dotenv";
import express from "express";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

// Load environment variables
dotenv.config();

// Use the exact environment variable keys from your original script
const GITHUB_USERNAME = process.env.username;
const GITHUB_PASSWORD = process.env.password;
const CLAY_WEBHOOK_URL = process.env.CLAY_WEBHOOK_URL;
const PORT = process.env.PORT || 3000;

// --- Puppeteer Logic (from your original script) wrapped in a function ---
async function generateV0Design(prompt: string): Promise<string> {
  if (!GITHUB_USERNAME || !GITHUB_PASSWORD) {
    throw new Error(
      "GitHub username or password not set in environment variables (check .env file for 'username' and 'password' keys)."
    );
  }

  let browser;
  // let browser = null;

  try {
    console.log("Launching browser...");
    // Keeping headless: false as per your working script, but add sandbox args.
    // NOTE: Consider changing headless to true or 'new' for actual server deployment.
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 800 },
      args: [
        "--start-maximized",
        "--no-sandbox", // Often needed for server/container environments
        "--disable-setuid-sandbox", // Often needed for server/container environments
      ],
    });

    const page = await browser.newPage();

    await page.goto("https://v0.dev", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    console.log("Waiting for Sign In button...");
    await page.waitForSelector('a[href*="/api/auth/login"]', { visible: true });
    await page.click('a[href*="/api/auth/login"]');

    console.log("Waiting for Vercel login page...");
    // Using waitForNavigation as in your original script
    await page.waitForNavigation({
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    console.log("Looking for GitHub button on Vercel login...");
    await page.waitForSelector('button[aria-label="Continue with GitHub"]', {
      visible: true,
      timeout: 60000,
    });

    // Using the popup handling from your original script
    const popupPromise = new Promise<Page>((resolve) => {
      browser.on("targetcreated", async (target) => {
        const newPage = await target.page();
        if (newPage && (await newPage.url()).includes("github.com/login")) {
          resolve(newPage);
        }
      });
    });

    await page.click('button[aria-label="Continue with GitHub"]');
    const githubPopup = await popupPromise;

    console.log("Filling GitHub login form...");
    await githubPopup.waitForSelector("#login_field");
    // Using GITHUB_USERNAME! (non-null assertion) as in original potential logic
    await githubPopup.type("#login_field", GITHUB_USERNAME!);

    await githubPopup.waitForSelector("#password");
    await githubPopup.type("#password", GITHUB_PASSWORD!);

    console.log("Submitting login form...");
    await githubPopup.keyboard.press("Enter");

    // Wait for redirect back to v0.dev using waitForNavigation
    console.log("Waiting for authentication to complete...");
    // It's possible the popup closing triggers navigation on the original page
    await page.waitForNavigation({
      waitUntil: "networkidle0",
      timeout: 90000, // Slightly increased timeout for auth redirects
    });

    // Make sure we're back on v0.dev using waitForFunction
    console.log("Waiting for v0.dev to load after login...");
    await page.waitForFunction(() => window.location.href.includes("v0.dev"), {
      timeout: 60000,
    });

    // Wait for the textarea to be present using waitForSelector with state: 'attached'
    console.log("Looking for textarea...");
    await page.waitForSelector("textarea", {
      visible: true, // Keep visible check
      timeout: 60000,
      // state: "attached", // 'state' is not a valid option here, relying on visible
    });

    console.log("Typing prompt...");
    // Ensure textarea is cleared before typing new prompt
    await page.evaluate(() => {
      const textarea = document.querySelector("textarea");
      if (textarea) textarea.value = "";
    });
    await page.type("textarea", prompt); // Use the prompt passed into the function

    console.log("Looking for submit button...");
    await page.waitForSelector('[data-testid="prompt-form-send-button"]', {
      visible: true,
      timeout: 60000,
      // state: "attached", // 'state' is not a valid option here
    });

    console.log("Clicking submit...");
    await page.click('[data-testid="prompt-form-send-button"]');

    // Wait for the URL to change using waitForFunction (as in original script)
    console.log("Waiting for generation to complete (URL change)...");
    const initialUrl = page.url(); // Get the URL before waiting
    await page.waitForFunction(
      (expectedInitialUrl) =>
        window.location.href !== expectedInitialUrl &&
        window.location.href.includes("v0.dev/t/"), // Make sure it's a generation URL
      { timeout: 180000 }, // Increased timeout as generation can take a while
      initialUrl
    );

    // Get and log the final URL
    const finalUrl = await page.evaluate(() => window.location.href);
    console.log("\nGenerated design URL:", finalUrl);

    await browser.close();
    console.log("Browser closed.");
    return finalUrl; // Return the URL
  } catch (error) {
    console.error("Error during Puppeteer automation:", error);
    if (browser) {
      await browser.close();
      console.log("Browser closed due to error.");
    }
    // Rethrow error for the API endpoint to catch
    throw error;
  }
}

// --- Express API Server Setup ---
const app = express();
app.use(express.json()); // Middleware to parse JSON request bodies

// POST endpoint to trigger the generation
app.post("/generate", async (req, res) => {
  const { websiteUrl } = req.body;

  if (!websiteUrl) {
    return res
      .status(400)
      .json({ error: "Missing 'websiteUrl' in request body" });
  }

  console.log(`API: Received request to generate design for: ${websiteUrl}`);

  // Construct the dynamic prompt for redesign
  const prompt = `Redesign this website: ${websiteUrl}. Make it clean and minimal.`;
  console.log(`API: Using prompt: "${prompt}"`);

  try {
    // Call the function containing your working Puppeteer logic
    const generatedUrl = await generateV0Design(prompt);
    console.log(`API: Successfully generated URL: ${generatedUrl}`);
    // Send the result back to Clay
    res.json({ generatedUrl: generatedUrl });
  } catch (error) {
    console.error("API endpoint error during generation:", error);
    // Send an error response back to Clay
    res
      .status(500)
      .json({ error: "Failed to generate design. Check server logs." });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(
    `Ready to accept POST requests at http://localhost:${PORT}/generate`
  );
  console.log(
    "Ensure ngrok is running and pointed to this port for Clay integration."
  );
});
