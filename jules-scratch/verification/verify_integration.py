
from playwright.sync_api import sync_playwright, expect
import json

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Mock the API response for /api/fact-check
    def handle_route(route):
        if "/api/fact-check" in route.request.url:
            print("Intercepting /api/fact-check call and returning mock response.")
            mock_response = {
                "id": "fc_mock_123",
                "originalText": "Recent studies suggest that climate change is accelerating, leading to more extreme weather events.",
                "final_verdict": "MOSTLY TRUE",
                "final_score": 85,
                "reasoning": "The claim is well-supported by a consensus in scientific literature, though the term 'accelerating' can be nuanced.",
                "evidence": [
                    {
                        "id": "ev_mock_1",
                        "publisher": "NASA Climate",
                        "url": "https://climate.nasa.gov/",
                        "quote": "The planet's average surface temperature has risen about 2.0 degrees Fahrenheit (1.1 degrees Celsius) since the late 19th century.",
                        "score": 95,
                        "type": "scientific"
                    },
                    {
                        "id": "ev_mock_2",
                        "publisher": "IPCC",
                        "url": "https://www.ipcc.ch/",
                        "quote": "Human activities, principally through emissions of greenhouse gases, have unequivocally caused global warming.",
                        "score": 98,
                        "type": "report"
                    }
                ],
                "metadata": {
                    "method_used": "mocked-tiered-verification",
                    "processing_time_ms": 1500,
                    "apis_used": ["mock-api"],
                    "sources_consulted": {"total": 2, "high_credibility": 2, "conflicting": 0},
                    "warnings": [],
                    "tier_breakdown": [
                        {"tier": "direct-verification", "success": True, "confidence": 88.0, "evidence_count": 2, "processing_time_ms": 500}
                    ]
                }
            }
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(mock_response)
            )
        else:
            route.continue_()

    try:
        page.route("**/*", handle_route)
        page.goto("http://localhost:5173/")

        textarea = page.get_by_placeholder("Paste your article, news content, or claim here for comprehensive fact-checking...")
        expect(textarea).to_be_visible()
        textarea.fill("Recent studies suggest that climate change is accelerating, leading to more extreme weather events.")

        analysis_panel = page.locator("div.bg-white.rounded-xl.shadow-sm.border.border-gray-200.p-6", has=textarea)
        analyze_button = analysis_panel.get_by_role("button", name="Analyze Content")
        expect(analyze_button).to_be_enabled()
        analyze_button.click()

        report_header = page.get_by_role("heading", name="Fact-Check Report")
        expect(report_header).to_be_visible(timeout=15000)

        # Take a screenshot of the successfully loaded report page
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Successfully captured screenshot of the report page.")

    except Exception as e:
        print(f"An error occurred during verification: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)
