from playwright.sync_api import sync_playwright

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:5173/")

        # Wait for the main header to be visible to ensure the page has loaded
        page.wait_for_selector('h1:has-text("TruScope Professional")')

        page.screenshot(path="jules-scratch/verification/truscope_platform_after_cleanup.png")
        browser.close()

if __name__ == "__main__":
    run_verification()
