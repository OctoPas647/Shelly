#!/usr/bin/env python3
"""Plays through Shelly in a headless phone-sized browser and saves screenshots to build/shots/.
   python tools/build.py web && python tools/build.py modules && python tests/play.py
   Needs: pip install playwright && playwright install chromium"""
import functools, http.server, pathlib, socketserver, sys, threading, zipfile
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB, MODS, SHOTS = ROOT / 'dist/web', ROOT / 'downloads/modules', ROOT / 'build/shots'
SHOTS.mkdir(parents=True, exist_ok=True)
for f in SHOTS.glob('*.png'): f.unlink()

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(WEB)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/index.html'

errors, n = [], [0]
def shot(page, name, full=False):
    n[0] += 1; page.wait_for_timeout(450)
    page.screenshot(path=str(SHOTS / f'{n[0]:02d}-{name}.png'), full_page=full)
def step(msg): print('  ·', msg, flush=True)

def add_module(page, path, choice='fresh'):
    with page.expect_file_chooser() as fc: page.click('[data-add]')
    fc.value.set_files(str(path))
    page.wait_for_selector('.sheet [data-act]')
    return choice

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 400, 'height': 860}, device_scale_factor=2, locale='bg-BG', accept_downloads=True)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
    page.goto(URL); page.wait_for_selector('.apphead')
    shot(page, 'library-empty')

    step('add the БЕЛ module')
    add_module(page, MODS / 'matura-bel.zip'); shot(page, 'add-sheet')
    page.click('.sheet [data-act="fresh"]'); page.wait_for_selector('.screen-module .hero')
    shot(page, 'module-bel'); shot(page, 'module-bel-full', True)

    step('lesson and practice')
    page.click('[data-lesson="bel-article"]'); page.wait_for_selector('.lesson-body'); shot(page, 'lesson', True)
    page.click('[data-start]'); page.wait_for_selector('.task')
    page.click('.gap.pick[data-g="0"] button[data-o="0"]'); page.click('.gap.pick[data-g="1"] button[data-o="1"]')
    shot(page, 'p1-gaps'); page.click('[data-main]'); shot(page, 'p1-right'); page.click('[data-main]')
    page.click('.hintbtn'); page.click('.opt[data-i="1"]'); shot(page, 'p2-hint'); page.click('[data-main]'); shot(page, 'p2-wrong', True); page.click('[data-main]')
    page.fill('.field', 'Въпроса.'); page.click('[data-main]'); shot(page, 'p3-text'); page.click('[data-main]')
    page.click('.bank .chip[data-w="Директорът"]'); page.click('.bank .chip[data-w="директора"]'); shot(page, 'p4-bank'); page.click('[data-main]'); page.click('[data-main]')
    page.click('.opt[data-i="0"]'); page.click('.opt[data-i="2"]'); page.click('[data-main]'); page.click('[data-main]')
    page.wait_for_selector('.result'); shot(page, 'practice-result', True)
    page.click('[data-out]'); page.wait_for_selector('.screen-module')

    step('exam')
    page.click('[data-exam="dzi-demo"]'); page.wait_for_selector('.exam-intro'); shot(page, 'exam-intro', True)
    page.click('[data-go]'); page.wait_for_selector('.exambar .timer')
    page.click('.opt[data-i="3"]'); page.click('[data-flag]'); shot(page, 'exam-task')
    page.click('[data-next]'); page.click('.opt[data-i="0"]')
    page.click('[data-nav]'); page.wait_for_selector('.navgrid'); shot(page, 'exam-navigator')
    page.click('.navgrid button >> text="9"'); page.wait_for_selector('textarea.essay')
    page.fill('textarea.essay', 'Домът е място на покой. Вечерта „смирено гасне“, а нощта идва да приласкае скръбните. Повторението „тихи… тиха“ засилва тишината. Завръщането е копнеж, не действителност.')
    page.click('[data-next]'); page.fill('textarea.essay', 'Тема 2. ' + 'Копнежът по дома е основен мотив. ' * 20)
    shot(page, 'exam-essay')
    page.click('[data-next]'); page.click('.sheet [data-act="yes"]'); page.wait_for_selector('.gradelist'); shot(page, 'exam-grade')
    for s in page.query_selector_all('.stepper [data-d="1"]')[:6]: s.click(); s.click()
    page.click('[data-done]'); page.wait_for_selector('.big-result'); shot(page, 'exam-result', True)
    page.click('.res-list [data-rev="0"]'); page.wait_for_selector('.sheet .task'); shot(page, 'exam-review'); page.click('.sheet [data-act="x"]')
    page.click('.result [data-back]'); page.wait_for_selector('.screen-module')
    assert not page.query_selector('[data-resume]'), 'finished exam still shows as in progress'
    shot(page, 'module-after', True)

    step('share with progress, remove, re-import and choose progress')
    page.click('[data-menu]'); page.click('.sheet [data-act="share"]'); page.wait_for_selector('.choices')
    page.click('.choice:nth-child(2)'); shot(page, 'share-sheet')
    with page.expect_download() as dl: page.click('.sheet [data-act="save"]')
    saved = ROOT / 'build' / dl.value.suggested_filename; dl.value.save_as(str(saved))
    names = zipfile.ZipFile(saved).namelist(); step(f'shared file {saved.name}: {names}')
    assert 'module.json' in names and 'progress.json' in names
    page.wait_for_timeout(600)
    page.click('[data-menu]'); page.click('.sheet [data-act="remove"]'); page.click('.sheet [data-act="yes"]'); page.wait_for_selector('.screen-library')
    add_module(page, saved); shot(page, 'import-with-progress')
    page.click('.sheet [data-act="theirs"]'); page.wait_for_selector('.screen-module .hero'); shot(page, 'module-restored')
    page.click('[data-back]'); page.wait_for_selector('.screen-library')

    step('math module: formulas, picture, match')
    add_module(page, MODS / 'matura-math.zip'); page.click('.sheet [data-act="fresh"]'); page.wait_for_selector('.screen-module .hero')
    shot(page, 'module-math')
    page.click('[data-lesson="m-quad"]'); page.wait_for_selector('.katex'); shot(page, 'lesson-math', True); page.click('[data-back]')
    page.click('[data-lesson="m-right"]'); page.wait_for_selector('.media-img img[src^="blob:"]'); shot(page, 'lesson-triangle', True)
    page.click('[data-start]'); page.fill('.field', '10'); page.click('[data-main]'); page.click('[data-main]')
    page.click('.opt[data-i="0"]'); page.click('[data-main]'); page.click('[data-main]')
    page.fill('.field', '12'); page.click('[data-main]'); page.click('[data-main]')
    page.click('.mi.l[data-l="0"]'); page.click('.mi.r >> nth=0'); page.click('.mi.l[data-l="1"]'); page.click('.mi.r >> nth=1'); shot(page, 'match')
    page.click('.mi.l[data-l="2"]'); page.click('.mi.r >> nth=2'); page.click('[data-main]'); shot(page, 'match-checked', True)
    page.click('[data-main]'); shot(page, 'open-task')
    page.click('[data-back]'); page.click('.sheet [data-act="yes"]'); page.wait_for_selector('.lesson-body')
    page.click('[data-back]'); page.click('[data-back]'); page.wait_for_selector('.screen-library'); shot(page, 'library-two')

    step('Arduino Bench: tables, code blocks, number units, exam with its own scale')
    add_module(page, MODS / 'arduino-bench.zip'); page.click('.sheet [data-act="fresh"]'); page.wait_for_selector('.screen-module .hero')
    shot(page, 'module-arduino'); shot(page, 'module-arduino-full', True)
    page.click('[data-lesson="u03-theory"]'); page.wait_for_selector('.tablewrap table'); shot(page, 'arduino-theory', True); page.click('[data-back]')
    page.click('[data-lesson="u03-lab1"]'); page.wait_for_selector('.codefig pre code'); shot(page, 'arduino-lab', True)
    page.click('.codefig [data-code-copy]'); page.wait_for_selector('.toast'); shot(page, 'arduino-copied')
    page.click('[data-start]'); page.wait_for_selector('.field-unit .unit')
    page.fill('.field', '1'); page.click('[data-main]'); page.wait_for_selector('.field.right'); shot(page, 'arduino-predict-right'); page.click('[data-main]')
    page.fill('.field', '13'); page.click('[data-main]'); page.wait_for_selector('.field.wrong'); shot(page, 'arduino-measure-wrong', True)
    assert '±' in page.inner_text('.solution'), 'a number task with a tolerance shows it next to the correct answer'
    page.click('[data-back]'); page.click('.sheet [data-act="yes"]'); page.wait_for_selector('.lesson-body')
    page.click('[data-back]'); page.wait_for_selector('.screen-module')
    page.click('[data-exam="bench-license"]'); page.wait_for_selector('.exam-intro'); shot(page, 'arduino-exam-intro', True)
    page.click('[data-back]'); page.wait_for_selector('.screen-module'); page.click('[data-back]'); page.wait_for_selector('.screen-library')

    step('English + dark')
    page.click('[data-settings]'); page.click('.seg[data-key="lang"] [data-v="en"]'); page.click('.seg[data-key="theme"] [data-v="dark"]'); shot(page, 'settings-dark', True)
    page.click('[data-back]'); page.wait_for_selector('.screen-library'); shot(page, 'library-dark-en')
    page.click('[data-open="bg.matura.math.demo"]'); page.wait_for_selector('.hero'); shot(page, 'module-dark-en', True)
    page.click('[data-lesson="m-right"]'); page.wait_for_selector('.lesson-body'); page.click('[data-start]'); page.fill('.field', '7'); page.click('[data-main]'); shot(page, 'dark-wrong')
    page.click('[data-back]'); page.click('.sheet [data-act="yes"]'); page.wait_for_selector('.lesson-body'); page.click('[data-back]'); page.click('[data-back]'); page.wait_for_selector('.screen-library')
    page.click('[data-open="en.electronics.arduino-bench"]'); page.wait_for_selector('.hero')
    page.click('[data-lesson="u06-theory"]'); page.wait_for_selector('.rt pre.codeblock'); shot(page, 'arduino-theory-dark-en', True); page.click('[data-back]')
    page.click('[data-lesson="u06-lab1"]'); page.wait_for_selector('.codefig'); shot(page, 'arduino-lab-dark-en')
    b.close()
srv.shutdown()
print('\n'.join(errors) if errors else '  no console errors')
print(f'  {n[0]} screenshots in {SHOTS.relative_to(ROOT)}')
sys.exit(1 if errors else 0)
