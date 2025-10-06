from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    context = browser.new_context(viewport={'width': 414, 'height': 896})  # iPhone XR viewport
    page = context.new_page()
    page.goto("http://localhost:5174/")

    # Open the sidebar
    page.locator('button[class="md:hidden text-gray-500 hover:text-gray-700"]').click()

    # Click the settings button
    page.locator('button:has-text("Settings")').click()

    # Wait for the modal to be visible
    page.wait_for_selector('div[aria-labelledby="modal-title"]')

    page.screenshot(path="jules-scratch/verification/settings_modal_screenshot.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
