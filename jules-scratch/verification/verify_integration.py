
from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Capture console logs
    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))

    try:
        # Navigate to the local development server
        page.goto("http://localhost:5173/")

        # Workaround for API key check - must provide all keys
        page.evaluate("() => { localStorage.clear(); }")
        api_keys = {
            'gemini_api_key': 'DUMMY_KEY',
            'gemini_model': 'gemini-pro',
            'fact_check_api_key': 'DUMMY_KEY',
            'search_api_key': 'DUMMY_KEY',
            'search_id': 'DUMMY_KEY',
            'newsdata_api_key': 'DUMMY_KEY',
            'serp_api_key': 'DUMMY_KEY'
        }
        for key, value in api_keys.items():
            page.evaluate(f"localStorage.setItem('{key}', '{value}')")

        page.reload()

        # Increased wait time for the page to potentially stabilize
        page.wait_for_timeout(2000)

        # Find the text area and enter some content
        textarea = page.get_by_placeholder("Paste your article, news content, or claim here for comprehensive fact-checking...")
        expect(textarea).to_be_visible(timeout=10000)
        textarea.fill("Recent studies suggest that climate change is accelerating.")

        # Click the "Analyze Content" button using a more specific locator
        analysis_panel = page.locator("div.bg-white.rounded-xl.shadow-sm.border.border-gray-200.p-6", has=textarea)
        analyze_button = analysis_panel.get_by_role("button", name="Analyze Content")
        expect(analyze_button).to_be_enabled()
        analyze_button.click()


        # Wait for the report tab to be visible and the report to be generated
        report_tab = page.get_by_role("button", name="Fact-Check Report")
        expect(report_tab).to_be_enabled(timeout=30000)

        report_header = page.get_by_role("heading", name="Fact-Check Report")
        expect(report_header).to_be_visible(timeout=10000)

        # Take a screenshot of the report
        page.screenshot(path="jules-scratch/verification/verification.png")

        print("Verification script completed successfully.")

    except Exception as e:
        print(f"An error occurred during verification: {e}")
        # Save HTML content for debugging
        with open("jules-scratch/verification/error.html", "w") as f:
            f.write(page.content())
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)
