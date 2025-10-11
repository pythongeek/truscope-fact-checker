from playwright.sync_api import sync_playwright, Page, expect

def verify_changes(page: Page):
    """
    This script verifies the frontend changes by performing a fact-check and taking a screenshot of the report.
    """
    # 1. Navigate to the application
    page.goto("http://localhost:3000/")

    # 2. Find the text area and enter a claim
    # Using a placeholder to find the textarea
    text_area = page.get_by_placeholder("Paste your article, news content, or claim here for comprehensive fact-checking...")
    expect(text_area).to_be_visible()
    text_area.fill("A new vaccine has been developed that is 100% effective.")

    # 3. Click the "Analyze Content" button
    # Use a more specific locator to target the correct button
    analyze_button = page.locator("div.flex.items-center.justify-between.mt-4 > button")
    expect(analyze_button).to_be_enabled()
    analyze_button.click()

    # 4. Wait for the report to be generated and take a screenshot
    # The report tab should become active
    report_tab = page.get_by_role("button", name="Fact-Check Report")
    expect(report_tab).to_be_enabled(timeout=60000) # Wait up to 60 seconds for analysis
    report_tab.click()

    # Wait for the report panel to be visible
    report_panel = page.locator("div.space-y-6:has-text('Fact-Check Report')")
    expect(report_panel).to_be_visible()

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        verify_changes(page)
        browser.close()

if __name__ == "__main__":
    main()
