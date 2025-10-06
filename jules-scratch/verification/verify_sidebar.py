from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    context = browser.new_context(viewport={'width': 414, 'height': 896})  # iPhone XR viewport
    page = context.new_page()
    page.goto("http://localhost:5174/")

    # Give the page a moment to load
    page.wait_for_selector('button[class="md:hidden text-gray-500 hover:text-gray-700"]')

    # Click the button to open the sidebar
    button = page.locator('button[class="md:hidden text-gray-500 hover:text-gray-700"]')
    button.click()

    # Wait for sidebar to be visible
    page.wait_for_selector('aside.translate-x-0')

    page.screenshot(path="jules-scratch/verification/sidebar_screenshot.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
