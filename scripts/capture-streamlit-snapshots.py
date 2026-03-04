#!/usr/bin/env python3

import argparse
from pathlib import Path

from playwright.sync_api import sync_playwright


def capture(url: str, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    desktop_path = output_dir / "streamlit-dashboard-desktop.png"
    mobile_path = output_dir / "streamlit-dashboard-mobile.png"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        desktop_context = browser.new_context(viewport={"width": 1440, "height": 960})
        desktop_page = desktop_context.new_page()
        desktop_page.goto(url, wait_until="networkidle")
        desktop_page.wait_for_timeout(4000)
        desktop_page.screenshot(path=str(desktop_path), full_page=True)
        desktop_context.close()

        mobile_context = browser.new_context(
            viewport={"width": 390, "height": 844},
            user_agent=(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            ),
            device_scale_factor=3,
            is_mobile=True,
            has_touch=True,
        )
        mobile_page = mobile_context.new_page()
        mobile_page.goto(url, wait_until="networkidle")
        mobile_page.wait_for_timeout(4000)
        mobile_page.screenshot(path=str(mobile_path), full_page=True)
        mobile_context.close()

        browser.close()

    print(f"Captured: {desktop_path}")
    print(f"Captured: {mobile_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Capture Streamlit dashboard screenshots.")
    parser.add_argument("--url", default="http://127.0.0.1:8501", help="Streamlit app URL")
    parser.add_argument("--output-dir", default="artifacts/ui", help="Output directory")
    args = parser.parse_args()

    capture(args.url, Path(args.output_dir))


if __name__ == "__main__":
    main()
