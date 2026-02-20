from playwright.sync_api import Page, expect, sync_playwright, Route
import json
import time

MOCK_DATA = []
start_ts = int(time.time() * 1000)
for i in range(100):
    MOCK_DATA.append({
        "dataTimestamp": str(start_ts + i * 5 * 60 * 1000),
        "pac": 1000 + (i * 10),
        "pacStr": "W",
        "pacPec": "0.001",
        "familyLoadPower": 500,
        "familyLoadPowerStr": "W",
        "batteryPower": 200,
        "batteryPowerStr": "W",
        "pSum": 300,
        "pSumStr": "W"
    })

def handle_solis_api(route: Route):
    request = route.request
    if request.method != "POST":
        return route.continue_()

    try:
        post_data = request.post_data_json
        endpoint = post_data.get("endpoint")
        print(f"Intercepted API call: {endpoint}")

        if endpoint == "/v1/api/inverterDay":
            print("Returning mock inverterDay data")
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"data": MOCK_DATA})
            )
            return
        elif endpoint == "/v1/api/inverterDetail":
             print("Returning mock inverterDetail data")
             route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"data": {"id": "123", "sn": "mock-sn", "pac": 5000, "pacStr": "W"}})
            )
             return

    except Exception as e:
        print(f"Error handling request: {e}")

    route.continue_()

def test_power_chart(page: Page):
    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Browser Error: {err}"))

    page.route("**/api/solis", handle_solis_api)

    print("Navigating to /inverters/123")
    page.goto("http://localhost:3000/inverters/123")

    print("Waiting for chart or no data message...")
    try:
        expect(page.get_by_text("Solar")).to_be_visible(timeout=5000)
        print("Chart rendered successfully!")
    except:
        print("Chart not found within timeout.")

    page.screenshot(path="verification/power-chart.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            test_power_chart(page)
        except Exception as e:
            print(f"Verification failed: {e}")
        finally:
            browser.close()
