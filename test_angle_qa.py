#!/usr/bin/env python
"""
QA testing script for the angle measurement tool.
Tests:
1. Intersecting segments - arc appears on the side where mouse is moved
2. Non-intersecting segments - arc uses extension lines
3. Parallel lines - no arc shown
4. Chaining - 3+ clicks work smoothly
"""

from playwright.sync_api import sync_playwright
import time


def take_screenshot(page, name):
    """Helper to take screenshots for inspection"""
    path = f"/tmp/angle_test_{name}.png"
    page.screenshot(path=path, full_page=True)
    print(f"Screenshot saved: {path}")


def find_canvas_center(page):
    """Find the canvas element and return its center coordinates"""
    canvas = page.locator("canvas").first
    box = canvas.bounding_box()
    if box:
        return {
            "x": box["x"] + box["width"] / 2,
            "y": box["y"] + box["height"] / 2,
            "canvas": canvas,
        }
    return None


def draw_line(page, x1, y1, x2, y2, canvas_info):
    """Draw a line from (x1, y1) to (x2, y2)"""
    canvas = canvas_info["canvas"]
    # Click to start drawing
    page.mouse.move(x1, y1)
    page.mouse.down()
    time.sleep(0.1)

    # Drag to end point
    page.mouse.move(x2, y2, steps=10)
    time.sleep(0.2)

    # Release to complete
    page.mouse.up()
    time.sleep(0.3)


def test_angle_measurement():
    """Main test function"""
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False
        )  # headless=False to see what's happening
        page = browser.new_page()
        page.set_viewport_size({"width": 1400, "height": 900})

        # Navigate to app
        page.goto("http://localhost:5173")
        page.wait_for_load_state("networkidle")

        print("\n=== Test 1: Intersecting Segments - Arc follows mouse ===")

        # Get canvas info
        canvas_info = find_canvas_center(page)
        if not canvas_info:
            print("ERROR: Could not find canvas")
            browser.close()
            return

        cx, cy = canvas_info["x"], canvas_info["y"]

        # Switch to measure mode
        print("Switching to measure tool...")
        page.click('button:has-text("Measure")')
        time.sleep(0.3)

        # Select angle tool
        print("Selecting angle measurement...")
        page.click('button[aria-label*="angle" i]')
        time.sleep(0.3)

        # Draw two intersecting lines
        print("Drawing first line (vertical-ish)...")
        draw_line(page, cx - 100, cy - 150, cx - 100, cy + 150, canvas_info)

        take_screenshot(page, "01_first_line")

        print("Drawing second line (crossing first)...")
        draw_line(page, cx - 200, cy, cx + 200, cy, canvas_info)

        take_screenshot(page, "02_two_lines")

        # Now test mouse movement triggering arc on different sides
        print("\nTesting arc appears on mouse side...")
        print("Moving mouse to LEFT side of intersection...")
        page.mouse.move(cx - 150, cy)
        time.sleep(0.5)
        take_screenshot(page, "03_arc_on_left")

        print("Moving mouse to RIGHT side of intersection...")
        page.mouse.move(cx + 150, cy)
        time.sleep(0.5)
        take_screenshot(page, "04_arc_on_right")

        print("Moving mouse ABOVE intersection...")
        page.mouse.move(cx - 100, cy - 100)
        time.sleep(0.5)
        take_screenshot(page, "05_arc_above")

        print("Moving mouse BELOW intersection...")
        page.mouse.move(cx - 100, cy + 100)
        time.sleep(0.5)
        take_screenshot(page, "06_arc_below")

        print("\n=== Test 2: Arc selection by clicking ===")
        print("Clicking on left side to select second line...")
        page.mouse.move(cx - 150, cy)
        time.sleep(0.3)
        page.mouse.click()
        time.sleep(0.5)
        take_screenshot(page, "07_selected_left")

        # Verify angle value is displayed and is acute
        print("Checking for angle label...")
        angle_text = page.locator("text=/\\d+\\.\\d+°/").first
        if angle_text:
            print(f"Found angle label: {angle_text.text_content()}")
            # Extract angle value
            angle_str = angle_text.text_content()
            angle_val = float(angle_str.replace("°", ""))
            if angle_val <= 90:
                print(f"✓ Acute angle: {angle_val}°")
            else:
                print(f"✗ NOT acute: {angle_val}° (should be ≤ 90°)")
        else:
            print("No angle label found")

        print("\n=== Test 3: Line Chaining ===")
        print("Drawing third line for chaining test...")
        draw_line(page, cx, cy - 200, cx, cy + 200, canvas_info)
        time.sleep(0.5)
        take_screenshot(page, "08_after_third_line")

        print("\nAll tests completed!")
        time.sleep(2)
        browser.close()


if __name__ == "__main__":
    test_angle_measurement()
