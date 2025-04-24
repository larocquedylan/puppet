import puppeteer, { Browser, Page } from "puppeteer";
import config from "../config/environment";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

// Get GitHub credentials from environment config
const GITHUB_USERNAME = config.github.username;
const GITHUB_PASSWORD = config.github.password;

export async function generateV0Design(prompt: string): Promise<string> {
  if (!GITHUB_USERNAME || !GITHUB_PASSWORD) {
    throw new Error(
      "GitHub username or password not set in environment variables (check .env file for 'username' and 'password' keys)."
    );
  }

  // Extract website URL from the prompt
  const websiteUrlMatch = prompt.match(
    /redesign this website: (https?:\/\/[^\s.]+\.[^\s]+)/i
  );
  const websiteUrl = websiteUrlMatch ? websiteUrlMatch[1] : null;

  // If website URL was found, extract images first
  let enhancedPrompt = prompt;

  let browser: Browser | undefined;
  try {
    console.log("Launching browser...");
    browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1280, height: 800 },
      args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.tracing.start({ path: "/tmp/trace.json", screenshots: true });

    await page.goto("https://v0.dev", {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    console.log("Waiting for Sign In button...");
    await page.waitForSelector('a[href*="/api/auth/login"]', { visible: true });
    await page.click('a[href*="/api/auth/login"]');

    console.log("Waiting for Vercel login page...");
    await page.waitForNavigation({
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    console.log("Looking for GitHub button on Vercel login...");
    await page.waitForSelector('button[aria-label="Continue with GitHub"]', {
      visible: true,
      timeout: 60000,
    });

    const popupPromise = new Promise<Page>((resolve) => {
      browser!.on("targetcreated", async (target) => {
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
    await githubPopup.type("#login_field", GITHUB_USERNAME!);

    await githubPopup.waitForSelector("#password");
    await githubPopup.type("#password", GITHUB_PASSWORD!);

    console.log("Submitting login form...");
    await githubPopup.keyboard.press("Enter");

    console.log("Waiting for authentication to complete...");
    await page.waitForNavigation({
      waitUntil: "networkidle0",
      timeout: 90000,
    });

    console.log("Waiting for v0.dev to load after login...");
    await page.waitForFunction(() => window.location.href.includes("v0.dev"), {
      timeout: 60000,
    });

    console.log("Looking for textarea...");
    await page.waitForSelector("textarea", {
      visible: true,
      timeout: 60000,
    });

    console.log("Typing prompt...");
    await page.evaluate(() => {
      const textarea = document.querySelector("textarea");
      if (textarea) textarea.value = "";
    });
    await page.type("textarea", enhancedPrompt);

    console.log("Looking for submit button...");
    await page.waitForSelector('[data-testid="prompt-form-send-button"]', {
      visible: true,
      timeout: 60000,
    });

    console.log("Clicking submit...");
    const urlBeforeSubmit = page.url();
    await page.click('[data-testid="prompt-form-send-button"]');

    await new Promise((r) => setTimeout(r, 1500));
    const urlAfterSubmit = await page.url();
    console.log(`URL immediately after submit: ${urlAfterSubmit}`);

    console.log(
      `Waiting for STABLE '/chat/' URL (different from the one immediately after submit)...`
    );
    let currentUrl = urlAfterSubmit;
    const pollingTimeout = 90000;
    const pollingInterval = 2000;
    const startTime = Date.now();
    let stableChatUrlFound = false;

    if (currentUrl.includes("v0.dev/chat/") && currentUrl !== urlBeforeSubmit) {
      console.log(
        `Polling: Detected usable chat URL immediately after submit: ${currentUrl}. Considering process complete.`
      );
      stableChatUrlFound = true;
    } else {
      console.log(
        `Starting polling loop as ${currentUrl} is not the target state yet.`
      );
      while (Date.now() - startTime < pollingTimeout) {
        currentUrl = page.url();

        if ((Date.now() - startTime) % 10000 < pollingInterval) {
          console.log(`Polling: Still waiting... Current URL: ${currentUrl}`);
        }

        if (
          currentUrl.includes("v0.dev/chat/") &&
          currentUrl !== urlAfterSubmit
        ) {
          console.log(
            `Polling: Detected stable/updated chat URL: ${currentUrl}. Process complete.`
          );
          stableChatUrlFound = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, pollingInterval));
      }
    }

    if (!stableChatUrlFound) {
      const elapsedTime = (Date.now() - startTime) / 1000;
      console.error(
        `Polling: Timeout reached after ${elapsedTime}s waiting for stable '/chat/' URL (different from ${urlAfterSubmit}). Last checked URL: ${currentUrl}`
      );
      const timeoutScreenshotPath = `timeout_snapshot_${Date.now()}.png`;
      try {
        if (page) {
          await page.screenshot({
            path: timeoutScreenshotPath,
            fullPage: true,
          });
          console.log(
            `Polling: Screenshot captured on timeout: ${timeoutScreenshotPath}`
          );
        } else {
          console.log(
            "Polling: Page object not available for timeout screenshot."
          );
        }
      } catch (screenshotError) {
        console.error(
          "Polling: Failed to capture screenshot on timeout:",
          screenshotError
        );
      }
      throw new Error(
        `Timeout waiting for stable '/chat/' URL via polling after ${elapsedTime}s. Last URL seen: ${currentUrl}`
      );
    }

    const finalUrl = currentUrl;
    console.log("\nGenerated design URL (Chat URL):", finalUrl);

    await page.tracing.stop();
    await browser.close();

    console.log("Browser closed.");
    return finalUrl;
  } catch (error) {
    console.error("Error during Puppeteer automation:", error);
    if (browser) {
      try {
        await browser.close();
        console.log("Browser closed due to error.");
      } catch (closeError) {
        console.error("Failed to close browser after error:", closeError);
      }
    }
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}
