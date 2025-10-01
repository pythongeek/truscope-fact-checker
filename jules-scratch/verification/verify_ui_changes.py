from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:5173/")

    # Enter text and run analysis
    page.locator("textarea").fill("New study shows dark chocolate is good for you.")
    page.get_by_role("button", name="Run Tiered Verification").click()

    # Wait for the error message to be visible
    # The application should display an error because API keys are not set
    error_message_locator = page.locator("p.text-red-300")
    expect(error_message_locator).to_be_visible(timeout=30000)
    expect(error_message_locator).not_to_be_empty()

    # Take screenshot of the error state
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as p:
    run_verification(p)
