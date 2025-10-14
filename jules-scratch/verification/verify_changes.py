
import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            await page.goto("http://127.0.0.1:3000")

            # Wait for the main content to be visible
            await expect(page.locator("h1:has-text('TruScope Professional')")).to_be_visible(timeout=30000)

            # Enter the text to be analyzed
            text_to_analyze = "Lilly Phillips, a 24-year-old from Derbyshire who quit her job at a supermarket to become an OnlyFans star, now earns over £6,000 a month. She was born in the United States and has a degree in astrophysics."
            await page.fill("textarea", text_to_analyze)

            # Click the "Analyze Content" button
            await page.click("button:has-text('Analyze Content')")

            # Wait for the report to be displayed
            await expect(page.locator("h2:has-text('Fact-Check Report')")).to_be_visible(timeout=60000)

            # Take a screenshot of the report
            await page.screenshot(path="jules-scratch/verification/verification.png")

            print("Screenshot taken successfully.")

        except Exception as e:
            print(f"An error occurred: {e}")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
