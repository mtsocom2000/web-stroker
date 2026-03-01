#!/usr/bin/env python
"""Simple inspection script to see the actual page structure"""

from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_viewport_size({"width": 1400, "height": 900})

    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")

    print("=== Page Structure ===")
    print(page.content()[:2000])

    print("\n=== Buttons on page ===")
    buttons = page.locator("button").all()
    for i, btn in enumerate(buttons[:20]):
        try:
            text = btn.text_content()
            aria_label = btn.get_attribute("aria-label")
            print(f"Button {i}: text='{text}' aria-label='{aria_label}'")
        except:
            print(f"Button {i}: (error reading)")

    browser.close()
