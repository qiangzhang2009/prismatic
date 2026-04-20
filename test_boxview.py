import asyncio
from crawl4ai import AsyncWebCrawler

async def test_boxview_click():
    print("=== Test: Click boxview transcription link ===")
    async with AsyncWebCrawler(verbose=False) as crawler:
        # Step 1: Load the transcription page
        result = await crawler.arun(
            url="http://www.wittgensteinsource.org/agora_show_book_transcription/31"
        )
        print(f"Page loaded. HTML: {len(result.html)} chars")
        
        # Step 2: Find and click the transcription link
        # The transcription link is in a <li> element with class "transcription"
        # Let's try clicking it using js_code
        
        # Click the first boxview link
        result2 = await crawler.arun(
            url="http://www.wittgensteinsource.org/agora_show_book_transcription/31",
            js_code="""
            // Click on the transcription link (the first boxview_link)
            await new Promise(resolve => setTimeout(resolve, 1000));
            const link = document.querySelector('li.transcription a');
            if (link) {
                console.log('Found link:', link.href);
                link.click();
            } else {
                console.log('No transcription link found');
            }
            """,
            wait_for="css:.ui-dialog, [role='dialog'], .boxview-popup, .muruca-popup, .widget",
            delay_before_return_html=5
        )
        print(f"After click. HTML: {len(result2.html)} chars, Markdown: {len(result2.markdown or '')} chars")
        
        # Check for actual manuscript text
        html = result2.html or ""
        has_german = "philosophische" in html or "Bemerkungen" in html or "Sprache" in html
        has_wittgenstein_text = "Wittgenstein" in html and len(html) > 5000
        print(f"Has German philosophical text: {has_german}")
        print(f"Has substantial Wittgenstein text: {has_wittgenstein_text}")
        
        # Try a different approach: click and wait for specific selectors
        print("\n=== Test: Alternative click approach ===")
        
        # Check what elements exist on the page
        elements_info = await crawler.arun(
            url="http://www.wittgensteinsource.org/agora_show_book_transcription/31",
            js_code="""
            const info = {
                transcriptionLinks: document.querySelectorAll('li.transcription a').length,
                boxviewLinks: document.querySelectorAll('.boxview_link').length,
                allLis: document.querySelectorAll('li').length,
                transcriptionLiText: ''
            };
            const tli = document.querySelector('li.transcription');
            if (tli) info.transcriptionLiText = tli.textContent.substring(0, 200);
            window._debugInfo = JSON.stringify(info);
            return info;
            """
        )
        import json
        try:
            debug = json.loads(elements_info.markdown or elements_info.html or '{}')
            print(f"Debug info: {json.dumps(debug, indent=2)}")
        except:
            print(f"Debug markdown: {elements_info.markdown[:500] if elements_info.markdown else 'none'}")
        
        # Try clicking the boxview link directly
        result3 = await crawler.arun(
            url="http://www.wittgensteinsource.org/agora_show_book_transcription/31",
            js_code="""
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Find any boxview link and click it
            const links = document.querySelectorAll('a.boxview_link');
            console.log('Found ' + links.length + ' boxview links');
            if (links.length > 0) {
                links[0].click();
                console.log('Clicked link 0');
            }
            """,
            delay_before_return_html=8
        )
        html3 = result3.html or ""
        print(f"After boxview click. HTML: {len(html3)} chars")
        # Check for dialog content
        has_dialog = '.ui-dialog' in html3 or 'widget_draggable' in html3
        print(f"Has dialog/widget in HTML: {has_dialog}")

asyncio.run(test_boxview_click())
