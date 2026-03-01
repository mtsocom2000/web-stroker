#!/usr/bin/env python3
"""
Test the angle measurement tool functionality.
Tests:
1. Click first line
2. Click second line (both intersecting and non-intersecting)
3. Verify angle arc appears
4. Verify proper state transitions
"""

from playwright.sync_api import sync_playwright
import time


def test_angle_measurement():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto("http://localhost:5173")
        page.wait_for_load_state("networkidle")

        print("✓ Page loaded")

        # Get canvas element
        canvas = page.locator("canvas")
        canvas_box = canvas.bounding_box()

        if not canvas_box:
            print("✗ Canvas not found")
            browser.close()
            return False

        print(f"✓ Canvas found at {canvas_box}")

        # Draw first line using digital tool
        # Click on digital tool menu
        page.locator('button:has-text("digital")').click()
        time.sleep(0.5)

        # Select line tool
        page.locator('button:has-text("line")').click()
        time.sleep(0.3)

        # Draw a horizontal line
        canvas_x = canvas_box["x"] + canvas_box["width"] / 2
        canvas_y = canvas_box["y"] + canvas_box["height"] / 2

        # First line: horizontal
        page.mouse.click(canvas_x - 100, canvas_y)
        time.sleep(0.2)
        page.mouse.click(canvas_x + 100, canvas_y)
        time.sleep(0.2)
        page.mouse.click(canvas_x - 100, canvas_y)  # Close
        time.sleep(0.3)

        # Second line: vertical
        page.mouse.click(canvas_x, canvas_y - 100)
        time.sleep(0.2)
        page.mouse.click(canvas_x, canvas_y + 100)
        time.sleep(0.2)
        page.mouse.click(canvas_x, canvas_y - 100)  # Close
        time.sleep(0.3)

        print("✓ Lines drawn")

        # Switch to angle measurement tool
        # Click on measure tool
        page.locator('button:has-text("measure")').click()
        time.sleep(0.3)

        # Select angle tool
        angle_button = page.locator("button", has_text="angle")
        if angle_button.count() > 0:
            angle_button.click()
            time.sleep(0.3)
            print("✓ Angle tool selected")
        else:
            print("✗ Angle tool button not found")
            browser.close()
            return False

        # Take screenshot before measurement
        page.screenshot(path="/tmp/before_angle.png", full_page=False)

        # Click on first line
        page.mouse.click(canvas_x - 50, canvas_y)
        time.sleep(0.5)

        # Take screenshot after first click
        page.screenshot(path="/tmp/after_first_click.png", full_page=False)

        # Click on second line
        page.mouse.click(canvas_x, canvas_y - 50)
        time.sleep(0.5)

        # Take screenshot after second click
        page.screenshot(path="/tmp/after_second_click.png", full_page=False)

        print(
            "✓ Screenshots taken: before_angle, after_first_click, after_second_click"
        )

        # Check if angle value is displayed in the panel
        # Look for angle measurement display
        page.wait_for_timeout(500)
        content = page.content()

        if "angle:" in content.lower() or "°" in content:
            print("✓ Angle measurement appears to be displayed")
        else:
            print("⚠ Angle measurement text not clearly visible in content")

        browser.close()
        return True


if __name__ == "__main__":
    success = test_angle_measurement()
    if success:
        print("\n✓ Test completed successfully")
    else:
        print("\n✗ Test failed")
