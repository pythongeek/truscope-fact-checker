
import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Emulate a mobile viewport to ensure the menu button is visible
        page = await browser.new_page(viewport={"width": 375, "height": 667})


        # Listen for all console events and print them
        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.type}: {msg.text}"))

        try:
            # Navigate to the application
            await page.goto("http://localhost:3000/")

            # Corrected the heading to match the actual application
            await expect(page.get_by_role("heading", name="TruScope Professional")).to_be_visible(timeout=15000)

            # Click the menu button to open the sidebar, using a more specific selector
            await page.locator("header button.md\\:hidden").click()

            # Click the settings button in the sidebar
            await page.locator("aside button[aria-label='Settings']").click()

            # Wait for the settings modal to appear
            modal_title = page.get_by_role("heading", name="API Configuration")
            await expect(modal_title).to_be_visible(timeout=10000)

            # Take a screenshot of the settings modal
            await page.screenshot(path="jules-scratch/verification/verification.png")

            print("✅ Screenshot captured successfully.")

        except Exception as e:
            print(f"❌ An error occurred: {e}")
            print("Capturing screenshot of the current state...")
            await page.screenshot(path="jules-scratch/verification/error.png")


        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
