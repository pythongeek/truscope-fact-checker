
import re
from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:3000/")

        # The main interface is already visible.
        # Fill the textarea in the AnalysisPanel
        input_text = "A new vaccine has been developed that is 100% effective against all variants."
        page.fill("textarea", input_text)

        # Use a more specific selector based on the parent div containing the word count
        # This will uniquely identify the button in the analysis panel
        word_count = len(input_text.split())
        container_regex = re.compile(f"{word_count} wordsAnalyze Content")

        container = page.locator("div", has_text=container_regex)
        analyze_button = container.get_by_role("button", name="Analyze Content")

        expect(analyze_button).to_be_visible(timeout=10000)
        analyze_button.click()

        # Wait for the report panel to appear
        # The ReportPanel has a h2 with text "Fact-Check Report"
        report_header = page.locator("h2:text('Fact-Check Report')")
        expect(report_header).to_be_visible(timeout=60000)

        page.screenshot(path="jules-scratch/verification/verification.png")
        browser.close()

if __name__ == "__main__":
    run()
