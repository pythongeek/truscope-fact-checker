from playwright.sync_api import sync_playwright
import sys

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Listen for console messages and print them
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

    try:
        page.goto("http://localhost:5174/")
        page.wait_for_selector('textarea', timeout=10000) # Reduced timeout
        page.fill('textarea', "jet fuel can't melt steel beams")

        button = page.locator('button:has-text("Run Analysis")')
        button.click()

        report_selector = "div.bg-slate-800\\/50.rounded-lg.border.border-slate-700.p-6:has(h3:has-text('Supporting Evidence'))"
        page.wait_for_selector(report_selector, timeout=60000)

        report_element = page.locator(report_selector)
        report_element.screenshot(path="jules-scratch/verification/report_screenshot.png")

    except Exception as e:
        print(f"An error occurred: {e}", file=sys.stderr)
        # Take a screenshot even on failure to see what the page looks like
        page.screenshot(path="jules-scratch/verification/error_screenshot.png")
        sys.exit(1) # Exit with a non-zero code to indicate failure

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
