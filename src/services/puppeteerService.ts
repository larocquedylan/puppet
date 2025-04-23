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
  if (websiteUrl) {
    try {
      console.log(
        `Extracting images from ${websiteUrl} to enhance the prompt...`
      );
      const imageUrls = await extractImagesFromWebsite(websiteUrl);

      // Filter out data: URLs, dummy images, and tiny icons
      // Focus on content images like banners, photos, etc.
      const contentImages = imageUrls.filter(
        (url) =>
          !url.startsWith("data:") &&
          !url.includes("dummy.png") &&
          !url.includes("flag") &&
          !url.toLowerCase().includes("icon")
      );

      // If we found potential content images, include them in the prompt
      if (contentImages.length > 0) {
        // Take up to 8 images, prioritizing JPGs and larger images which are more likely to be content
        // Use set to remove duplicates
        const uniqueImages = [...new Set(contentImages)];
        const selectedImages = uniqueImages
          .filter(
            (url) =>
              url.toLowerCase().endsWith(".jpg") ||
              url.toLowerCase().endsWith(".jpeg")
          )
          .concat(
            uniqueImages.filter(
              (url) =>
                !url.toLowerCase().endsWith(".jpg") &&
                !url.toLowerCase().endsWith(".jpeg")
            )
          )
          .slice(0, 8);

        const imageReferences = selectedImages.join("\n");
        enhancedPrompt = `${prompt}\n\nUse these actual images from the original website in your redesign:\n${imageReferences}`;
        console.log(
          `Enhanced prompt with ${selectedImages.length} image references`
        );
      }
    } catch (error) {
      console.warn(
        `Failed to extract images to enhance prompt: ${error}. Continuing with original prompt.`
      );
    }
  }

  let browser: Browser | undefined;
  try {
    console.log("Launching browser...");
    browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1280, height: 800 },
      args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
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

export async function extractImagesFromWebsite(
  websiteUrl: string
): Promise<string[]> {
  let browser: Browser | undefined;
  try {
    console.log(`Launching browser to extract images from ${websiteUrl}...`);
    browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1280, height: 800 },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ],
      executablePath: "/nix/store/chromium-*-unwrapped/libexec/chromium/chrome",
    });

    const page = await browser.newPage();
    console.log(`Navigating to ${websiteUrl}...`);
    await page.goto(websiteUrl, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    console.log("Extracting image URLs...");
    const imageUrls = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll("img"));
      return images
        .map((img) => {
          const src = img.getAttribute("src") || "";
          const srcset = img.getAttribute("srcset") || "";

          // For srcset, extract the first URL (ignoring size descriptors)
          let srcsetUrl = "";
          if (srcset) {
            const srcsetParts = srcset.split(",")[0].trim().split(" ")[0];
            srcsetUrl = srcsetParts || "";
          }

          // Return src if available, otherwise try srcset
          return src || srcsetUrl;
        })
        .filter((url) => url) // Remove empty URLs
        .map((url) => {
          // Convert relative URLs to absolute
          try {
            return new URL(url, window.location.origin).href;
          } catch (e) {
            return url; // Return original if URL parsing fails
          }
        });
    });

    console.log(`Found ${imageUrls.length} images on ${websiteUrl}`);
    await browser.close();
    return imageUrls;
  } catch (error) {
    console.error(`Error extracting images from ${websiteUrl}:`, error);
    if (browser) await browser.close();
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

export async function downloadImagesFromWebsite(websiteUrl: string): Promise<{
  imageUrls: string[];
  downloadedImages: { originalUrl: string; localPath: string }[];
}> {
  let browser: Browser | undefined;
  const downloadDir = path.join(process.cwd(), "downloads", uuidv4());

  try {
    // Create download directory
    fs.mkdirSync(downloadDir, { recursive: true });
    console.log(`Created download directory: ${downloadDir}`);

    // Extract image URLs
    const imageUrls = await extractImagesFromWebsite(websiteUrl);

    // Download images
    console.log(`Downloading ${imageUrls.length} images from ${websiteUrl}...`);
    const downloadedImages = await Promise.all(
      imageUrls.map(async (url, index) => {
        try {
          const extension = path.extname(new URL(url).pathname) || ".jpg";
          const filename = `image_${index + 1}${extension}`;
          const localPath = path.join(downloadDir, filename);

          const response = await axios({
            method: "get",
            url: url,
            responseType: "stream",
            timeout: 30000,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
          });

          const writer = fs.createWriteStream(localPath);
          response.data.pipe(writer);

          await new Promise<void>((resolve, reject) => {
            writer.on("finish", () => resolve());
            writer.on("error", (err) => reject(err));
          });

          console.log(`Downloaded: ${url} -> ${localPath}`);
          return { originalUrl: url, localPath };
        } catch (error) {
          console.error(`Failed to download ${url}:`, error);
          return { originalUrl: url, localPath: "download_failed" };
        }
      })
    );

    return { imageUrls, downloadedImages };
  } catch (error) {
    console.error(`Error downloading images from ${websiteUrl}:`, error);
    throw error;
  }
}
