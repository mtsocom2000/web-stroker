#!/usr/bin/env python
"""
QA testing script for the angle measurement tool - simplified version
"""

from playwright.sync_api import sync_playwright
import time


def test_angle():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.set_viewport_size({"width": 1400, "height": 900})

        page.goto("http://localhost:5173")
        page.wait_for_load_state("networkidle")

        print("Page loaded")
        time.sleep(1)

        # Find the Measure button (button 16 based on inspection)
        buttons = page.locator("button").all()
        print(f"Found {len(buttons)} buttons")

        # Find Measure button by text
        measure_btn = page.locator('button:has-text("Measure")').first
        if measure_btn:
            print("Found Measure button")
            measure_btn.click()
            time.sleep(0.5)

        # Now look for angle tool button - should be a submenu item
        # Try finding all buttons again to see new ones
        time.sleep(0.5)
        buttons_after = page.locator("button").all()
        print(f"After clicking Measure: {len(buttons_after)} buttons")

        # Look for angle button
        angle_buttons = page.locator('button:has-text("Angle")').all()
        print(f"Found {len(angle_buttons)} angle buttons")
        if angle_buttons:
            angle_buttons[0].click()
            print("Clicked angle button")
            time.sleep(0.5)

        # Take a screenshot
        page.screenshot(path="/tmp/after_angle_select.png")
        print("Screenshot saved")

        # Now try to draw - click on canvas to draw lines
        canvas = page.locator("canvas").first
        box = canvas.bounding_box()

        if box:
            cx = box["x"] + box["width"] / 2
            cy = box["y"] + box["height"] / 2

            print(f"Canvas center: ({cx}, {cy})")

            # Draw first line (vertical)
            print("Drawing first line...")
            page.mouse.move(cx - 100, cy - 150)
            page.mouse.down()
            page.mouse.move(cx - 100, cy + 150, steps=10)
            page.mouse.up()
            time.sleep(0.5)

            page.screenshot(path="/tmp/first_line.png")

            # Draw second line (horizontal)
            print("Drawing second line...")
            page.mouse.move(cx - 200, cy)
            page.mouse.down()
            page.mouse.move(cx + 200, cy, steps=10)
            page.mouse.up()
            time.sleep(0.5)

            page.screenshot(path="/tmp/second_line.png")

            # Move mouse around to see arc
            print("Testing arc movement...")
            page.mouse.move(cx - 150, cy)
            time.sleep(0.3)
            page.screenshot(path="/tmp/arc_left.png")

            page.mouse.move(cx + 150, cy)
            time.sleep(0.3)
            page.screenshot(path="/tmp/arc_right.png")

        print("Test complete!")
        time.sleep(2)
        browser.close()


if __name__ == "__main__":
    test_angle()
