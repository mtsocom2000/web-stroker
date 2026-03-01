from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Navigate to the application
    page.goto("http://localhost:5176")
    page.wait_for_load_state("networkidle")

    # Take an initial screenshot
    page.screenshot(path="/tmp/angle_test_1_initial.png", full_page=False)

    # Step 1: Switch to Digital mode and draw some lines
    print("Step 1: Clicking on Digital mode button...")
    digital_button = page.locator('button:has-text("Digital")').first
    if digital_button:
        digital_button.click()
        page.wait_for_timeout(500)

    # Step 2: Select Line tool in Digital mode
    print("Step 2: Selecting Line tool...")
    line_button = page.locator('button:has-text("Line")').first
    if line_button:
        line_button.click()
        page.wait_for_timeout(300)

    # Step 3: Draw first line
    print("Step 3: Drawing first line...")
    canvas = page.locator("canvas").first
    if canvas:
        # Get canvas bounding box
        box = canvas.bounding_box()
        if box:
            # Draw a horizontal line
            x1, y1 = box["x"] + 100, box["y"] + 200
            x2, y2 = box["x"] + 300, box["y"] + 200

            page.mouse.move(x1, y1)
            page.mouse.down()
            page.mouse.move(x2, y2)
            page.mouse.up()
            page.wait_for_timeout(300)

            # Close the polyline with right-click
            page.mouse.click(x1, y1, button="right")
            page.wait_for_timeout(500)

    page.screenshot(path="/tmp/angle_test_2_first_line.png", full_page=False)

    # Step 4: Draw second line
    print("Step 4: Drawing second line...")
    if canvas:
        box = canvas.bounding_box()
        if box:
            # Draw a diagonal line that crosses the first
            x1, y1 = box["x"] + 200, box["y"] + 100
            x2, y2 = box["x"] + 200, box["y"] + 300

            page.mouse.move(x1, y1)
            page.mouse.down()
            page.mouse.move(x2, y2)
            page.mouse.up()
            page.wait_for_timeout(300)

            # Close the polyline with right-click
            page.mouse.click(x1, y1, button="right")
            page.wait_for_timeout(500)

    page.screenshot(path="/tmp/angle_test_3_second_line.png", full_page=False)

    # Step 5: Switch to Angle measurement tool
    print("Step 5: Switching to Angle measurement tool...")

    # Find the Measure tab or button
    measure_buttons = page.locator('button:has-text("Measure")')
    if measure_buttons.count() > 0:
        measure_buttons.first.click()
        page.wait_for_timeout(300)

    # Click on Angle measurement button
    angle_buttons = page.locator('button:has-text("Angle")')
    if angle_buttons.count() > 0:
        angle_buttons.first.click()
        page.wait_for_timeout(500)

    page.screenshot(path="/tmp/angle_test_4_angle_tool.png", full_page=False)

    # Step 6: Test selecting first line
    print("Step 6: Clicking on first line to select it...")
    if canvas:
        box = canvas.bounding_box()
        if box:
            # Click on the first line (horizontal)
            x, y = box["x"] + 200, box["y"] + 200
            page.mouse.click(x, y)
            page.wait_for_timeout(500)

    page.screenshot(path="/tmp/angle_test_5_first_selected.png", full_page=False)

    # Step 7: Test selecting second line (should show angle arc)
    print("Step 7: Clicking on second line to complete angle measurement...")
    if canvas:
        box = canvas.bounding_box()
        if box:
            # Click on the second line (vertical)
            x, y = box["x"] + 200, box["y"] + 200
            page.mouse.click(x, y)
            page.wait_for_timeout(500)

    page.screenshot(path="/tmp/angle_test_6_angle_measured.png", full_page=False)

    # Step 8: Test right-click to cancel current measurement (should keep tool active)
    print("Step 8: Right-clicking to cancel measurement...")
    if canvas:
        box = canvas.bounding_box()
        if box:
            x, y = box["x"] + 250, box["y"] + 250
            page.mouse.click(x, y, button="right")
            page.wait_for_timeout(500)

    page.screenshot(path="/tmp/angle_test_7_after_rightclick.png", full_page=False)

    # Step 9: Test chaining - select first line again (should still be able to measure)
    print("Step 9: Testing chaining - selecting first line again...")
    if canvas:
        box = canvas.bounding_box()
        if box:
            x, y = box["x"] + 200, box["y"] + 200
            page.mouse.click(x, y)
            page.wait_for_timeout(500)

    page.screenshot(path="/tmp/angle_test_8_chaining.png", full_page=False)

    # Step 10: Check console for errors
    print("Step 10: Checking console logs...")
    logs = page.evaluate("() => window.__consoleLogs || []")
    print(f"Console logs: {logs}")

    print("\nQA Testing Complete!")
    print("Screenshots saved to /tmp/")

    browser.close()
