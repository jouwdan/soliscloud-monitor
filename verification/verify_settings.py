from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # Go to settings page
            page.goto("http://localhost:3000/settings")

            # Wait for content to load
            page.wait_for_selector("h1:has-text('Settings')")

            # Check Tariff Rate Groups section
            expect(page.get_by_text("Tariff Rate Groups")).to_be_visible()

            # Take screenshot of initial state
            page.screenshot(path="verification/settings_initial.png")
            print("Initial screenshot taken")

            # Find the first tariff group input (Name)
            # The input with placeholder "Group name"
            first_group_name = page.get_by_placeholder("Group name").first
            first_group_name.fill("Test Group Updated")

            # Change start time of first slot
            # There are Select triggers. Let's try to find the one for "From"
            # The structure is From -> Select -> Trigger
            # We can find the label "From" and get the next sibling or parent's child

            # Let's just take a screenshot after renaming to confirm UI is responsive
            page.screenshot(path="verification/settings_renamed.png")
            print("Renamed screenshot taken")

            # Try to add a new group
            page.get_by_role("button", name="Add Tariff Period").click()

            # Wait a bit for the new group to appear
            time.sleep(0.5)

            # Take screenshot after adding
            page.screenshot(path="verification/settings_added.png")
            print("Added screenshot taken")

            # Verify "New Period" exists
            expect(page.get_by_value("New Period")).to_be_visible()

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
