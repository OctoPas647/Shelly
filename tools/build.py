#!/usr/bin/env python3
"""
Shelly build tool. Run from anywhere:

  python tools/build.py web        single page for testing on a PC   -> dist/web/index.html
  python tools/build.py serve      live preview at http://localhost:8000 (refresh to see edits)
  python tools/build.py modules    pack every folder in modules/ into a module file -> downloads/modules/<id>.zip
  python tools/build.py check      module checks, engine tests and text checks (needs Node.js 18+)
  python tools/build.py android    signed Android APK               -> dist/android/Shelly-<version>.apk
  python tools/build.py bump [patch|minor|major]   raise the version number

The app itself never contains a module: modules are separate .zip files you add inside the app.
Only Python 3.9+ is needed for web/serve/modules. Android also needs a JDK (17+) and the Android SDK
with build-tools 35+ and platform 34 (see README.md).
"""
import functools, http.server, json, os, pathlib, re, shutil, socketserver, subprocess, sys, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST, BUILD = ROOT / 'dist', ROOT / 'build'
CFG_PATH = ROOT / 'tools' / 'config.json'
CFG = json.loads(CFG_PATH.read_text(encoding='utf-8'))

def read(p): return (p if isinstance(p, pathlib.Path) else ROOT / p).read_text(encoding='utf-8')
def write(p, text): p.parent.mkdir(parents=True, exist_ok=True); p.write_text(text, encoding='utf-8')
def say(msg): print(f'  {msg}', flush=True)

# ---------------- bundling ----------------
def js_files(): return sorted((ROOT / 'app/js').glob('*.js'))

def js_bundle():
    head = f'const APP_NAME = {json.dumps(CFG["appName"])}, APP_VERSION = {json.dumps(CFG["version"])};\n'
    parts = [head, '/* ==== app/vendor/katex.min.js ==== */\n' + read('app/vendor/katex.min.js')]
    parts += [f'/* ==== {f.relative_to(ROOT).as_posix()} ==== */\n' + read(f) for f in js_files()]
    return '\n;\n'.join(parts)

def css_bundle():
    files = [ROOT / 'assets/fonts/fonts.css', ROOT / 'app/vendor/katex.css'] + sorted((ROOT / 'app/css').glob('*.css'))
    return '\n'.join(read(f) for f in files)

def page(pre_script=''):
    html = read('app/index.template.html')
    for k, v in {'TITLE': CFG['appName'], 'HEAD': '', 'PRE_SCRIPT': pre_script}.items():
        html = html.replace('{{' + k + '}}', v)
    html = html.replace('{{CSS}}', css_bundle(), 1)  # CSS and JS last, with functions, so backslashes stay as they are
    return re.sub(r'\{\{JS\}\}', lambda m: js_bundle(), html, count=1)

def copy_fonts(dest):
    (dest / 'fonts').mkdir(parents=True, exist_ok=True)
    for f in (ROOT / 'assets/fonts').glob('*.woff2'): shutil.copy2(f, dest / 'fonts' / f.name)

# ---------------- targets ----------------
def build_web():
    out = DIST / 'web'
    write(out / 'index.html', page()); copy_fonts(out)
    say(f'web      -> {(out / "index.html").relative_to(ROOT)}  ({(out / "index.html").stat().st_size // 1024} KB)')
    return out

def serve(port=8000):
    out = build_web()
    class H(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path in ('/', '/index.html'):
                body = page().encode('utf-8'); self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(body))); self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(body)
            else: super().do_GET()
        def log_message(self, *a): pass
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', port), functools.partial(H, directory=str(out))) as s:
        say(f'serving http://localhost:{port}  (Ctrl+C to stop)'); s.serve_forever()

def pack_modules(only=None):
    """Each folder in modules/ (with a module.json) becomes one .zip that people add in the app."""
    out_dir = ROOT / 'downloads' / 'modules'; out_dir.mkdir(parents=True, exist_ok=True); made = []
    for d in sorted(p for p in (ROOT / 'modules').iterdir() if (p / 'module.json').is_file()):
        if only and d.name not in only: continue
        meta = json.loads(read(d / 'module.json'))
        out = out_dir / f"{d.name}.zip"
        with zipfile.ZipFile(out, 'w') as z:
            for f in sorted(d.rglob('*')):
                if not f.is_file() or f.name.startswith('.') or f.name == 'README.md': continue
                rel = f.relative_to(d).as_posix()
                if rel == 'progress.json': continue
                z.write(f, rel, compress_type=zipfile.ZIP_DEFLATED if f.suffix in ('.json', '.svg', '.txt', '.md') else zipfile.ZIP_STORED)
        say(f'module   -> {out.relative_to(ROOT)}  ({meta["title"]} {meta["version"]}, {max(1, out.stat().st_size // 1024)} KB)'); made.append(out)
    return made

def check():
    node = shutil.which('node')
    if not node: sys.exit('Node.js is needed for checks.')
    r = subprocess.run([node, str(ROOT / 'tools/check.js')], cwd=ROOT)
    if r.returncode: sys.exit(r.returncode)
    tmp = BUILD / 'check-bundle.js'; write(tmp, js_bundle())
    r = subprocess.run([node, '--check', str(tmp)], capture_output=True, text=True)
    if r.returncode: print(r.stderr); sys.exit('The app bundle has a syntax error.')
    say('bundle syntax ok')

# ---------------- Android ----------------
def find_sdk():
    cands = [os.environ.get('ANDROID_HOME'), os.environ.get('ANDROID_SDK_ROOT'),
             os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Android', 'Sdk'),
             os.path.expanduser('~/Library/Android/sdk'), os.path.expanduser('~/Android/Sdk'), os.path.expanduser('~/android-sdk')]
    for c in cands:
        if c and (pathlib.Path(c) / 'build-tools').is_dir(): return pathlib.Path(c)
    sys.exit('Android SDK not found. Install it (see README.md) and set ANDROID_HOME to its folder.')

def vkey(name): return tuple(int(x) if x.isdigit() else 0 for x in re.split(r'[.-]', name))

def tool(folder, name):
    for ext in ('', '.exe', '.bat'):
        p = folder / (name + ext)
        if p.exists(): return str(p)
    found = shutil.which(name)
    if found: return found
    sys.exit(f'Could not find "{name}" in {folder}')

def java_tool(name):
    jh = os.environ.get('JAVA_HOME')
    if jh:
        for ext in ('', '.exe'):
            p = pathlib.Path(jh) / 'bin' / (name + ext)
            if p.exists(): return str(p)
    found = shutil.which(name)
    if not found: sys.exit(f'"{name}" not found. Install a JDK (17 or newer) and set JAVA_HOME.')
    return found

def run(cmd):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout[-3000:], r.stderr[-3000:]); sys.exit(f'Step failed: {pathlib.Path(str(cmd[0])).name}')
    return r.stdout

def build_android():
    sdk = find_sdk()
    bt = sorted((d for d in (sdk / 'build-tools').iterdir() if d.is_dir()), key=lambda d: vkey(d.name))[-1]
    if vkey(bt.name) < (35,): say(f'warning: build-tools {bt.name} found; 35+ is recommended')
    tgt = CFG['androidTargetSdk']
    plats = sorted((d for d in (sdk / 'platforms').glob('android-*') if (d / 'android.jar').exists()), key=lambda d: vkey(d.name.split('-')[1]))
    plat = next((d for d in plats if d.name == f'android-{tgt}'), plats[-1] if plats else None)
    if not plat: sys.exit('No Android platform installed. Install "platforms;android-34" with sdkmanager.')
    jar = plat / 'android.jar'
    pa = ROOT / 'platforms/android'; b = BUILD / 'android'
    if b.exists(): shutil.rmtree(b)
    for d in ('res', 'assets', 'gen', 'classes', 'dex'): (b / d).mkdir(parents=True)
    shutil.copytree(pa / 'res', b / 'res', dirs_exist_ok=True)
    shutil.copytree(ROOT / 'assets/icons/android', b / 'res', dirs_exist_ok=True)
    write(b / 'assets/index.html', page(pre_script='<script>\n' + read('platforms/android/bridge.js') + '\n</script>'))
    copy_fonts(b / 'assets')
    pkg = CFG['androidPackage']
    write(b / 'AndroidManifest.xml', read('platforms/android/AndroidManifest.xml').replace('package="app.shelly"', f'package="{pkg}"').replace('app.shelly.files', f'{pkg}.files'))
    write(b / 'res/values/strings.xml', f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">{CFG["appName"]}</string>\n</resources>\n')
    say(f'android  SDK {sdk} · build-tools {bt.name} · {plat.name}')
    run([tool(bt, 'aapt2'), 'compile', '--dir', b / 'res', '-o', b / 'res.zip'])
    run([tool(bt, 'aapt2'), 'link', '-o', b / 'base.apk', '-I', jar, '--manifest', b / 'AndroidManifest.xml', '-R', b / 'res.zip', '--java', b / 'gen', '-A', b / 'assets',
         '--min-sdk-version', CFG['androidMinSdk'], '--target-sdk-version', tgt, '--version-code', CFG['androidVersionCode'], '--version-name', CFG['version'],
         '--auto-add-overlay', '-0', 'woff2'])
    java = sorted((pa / 'java').rglob('*.java')) + sorted((b / 'gen').rglob('*.java'))
    run([java_tool('javac'), '-nowarn', '-Xlint:-options', '-encoding', 'UTF-8', '-source', '8', '-target', '8', '-bootclasspath', jar, '-classpath', jar, '-d', b / 'classes'] + java)
    run([tool(bt, 'd8'), '--release', '--min-api', CFG['androidMinSdk'], '--lib', jar, '--output', b / 'dex'] + sorted((b / 'classes').rglob('*.class')))
    unsigned = b / 'unsigned.apk'; shutil.copy2(b / 'base.apk', unsigned)
    with zipfile.ZipFile(unsigned, 'a', zipfile.ZIP_DEFLATED) as zf: zf.write(b / 'dex' / 'classes.dex', 'classes.dex')
    run([tool(bt, 'zipalign'), '-p', '-f', '4', unsigned, b / 'aligned.apk'])
    sj = pa / 'signing' / 'signing.json'
    if not sj.exists():
        import secrets
        say('no signing.json found: creating a new signing setup in platforms/android/signing/')
        pw = secrets.token_urlsafe(18)
        write(sj, json.dumps({'keystore': 'shelly.keystore', 'alias': 'shelly', 'storePassword': pw, 'keyPassword': pw}, indent=2))
    sg = json.loads(sj.read_text(encoding='utf-8')); ks = pa / 'signing' / sg['keystore']
    if not ks.exists():
        say('no signing key found: creating a new one (keep platforms/android/signing/ safe: updates must be signed with the same key)')
        run([java_tool('keytool'), '-genkeypair', '-keystore', ks, '-alias', sg['alias'], '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
             '-storepass', sg['storePassword'], '-keypass', sg['keyPassword'], '-dname', 'CN=Shelly, O=Shelly'])
    out = DIST / 'android' / f"{CFG['appName']}-{CFG['version']}.apk"; out.parent.mkdir(parents=True, exist_ok=True)
    run([tool(bt, 'apksigner'), 'sign', '--ks', ks, '--ks-key-alias', sg['alias'], '--ks-pass', 'pass:' + sg['storePassword'], '--key-pass', 'pass:' + sg['keyPassword'], '--out', out, b / 'aligned.apk'])
    run([tool(bt, 'apksigner'), 'verify', out])
    say(f'android  -> {out.relative_to(ROOT)}  ({out.stat().st_size // 1024} KB)')
    return out

def bump(part='patch'):
    v = [int(x) for x in CFG['version'].split('.')]
    i = {'major': 0, 'minor': 1, 'patch': 2}[part]; v[i] += 1; v[i + 1:] = [0] * (2 - i)
    CFG['version'] = '.'.join(map(str, v)); CFG['androidVersionCode'] += 1
    CFG_PATH.write_text(json.dumps(CFG, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    say(f'version  -> {CFG["version"]} (Android code {CFG["androidVersionCode"]})')

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'web'
    if cmd == 'web': build_web()
    elif cmd == 'serve': serve(int(sys.argv[2]) if len(sys.argv) > 2 else 8000)
    elif cmd == 'modules': pack_modules(sys.argv[2:] or None)
    elif cmd == 'check': check()
    elif cmd == 'android': build_android()
    elif cmd == 'bump': bump(sys.argv[2] if len(sys.argv) > 2 else 'patch')
    else: sys.exit(__doc__)
