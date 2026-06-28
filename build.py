#!/usr/bin/env python3
"""Assemble public/index.html from foundation + data + implementations."""

import json, re, os

BASE = os.path.dirname(os.path.abspath(__file__))

def read(path):
    with open(os.path.join(BASE, path), 'r') as f:
        return f.read()

def main():
    html = read('src/app-foundation.html')

    # 1. Embed real schedule-data.json (use string find/replace to avoid regex escaping issues)
    schedule = read('src/data/schedule-data.json').strip()
    sched_marker = '<script type="application/json" id="schedule-data">'
    sched_end = '</script>'
    si = html.find(sched_marker)
    if si != -1:
        se = html.find(sched_end, si + len(sched_marker))
        html = html[:si] + sched_marker + schedule + html[se:]

    # 2. Embed real history-seed.json
    history = read('src/data/history-seed.json').strip()
    hist_marker = '<script type="application/json" id="history-seed">'
    hi = html.find(hist_marker)
    if hi != -1:
        he = html.find(sched_end, hi + len(hist_marker))
        html = html[:hi] + hist_marker + history + html[he:]

    # 3. Read implementation chunks
    chunk3 = read('src/chunk3-home.js')
    chunk4 = read('src/chunk4-tabs.js')

    # 4. Insert implementations before the stub block and remove stubs
    # The stubs start with "// ---- Tab render stubs" comment
    # and end just before "// ---- Seed history"
    stub_start = '  // ---- Tab render stubs (to be replaced by feature agents) ----'
    stub_end = '  // ---- Seed history (PRD 11) ----'

    idx_start = html.find(stub_start)
    idx_end = html.find(stub_end)

    if idx_start == -1 or idx_end == -1:
        print("ERROR: Could not find stub markers in foundation HTML")
        print(f"  stub_start found: {idx_start != -1}")
        print(f"  stub_end found: {idx_end != -1}")
        # Try alternative markers
        if idx_start == -1:
            # Search for the renderToday function
            alt = html.find('function renderToday()')
            print(f"  'function renderToday()' at: {alt}")
        return

    # Build the replacement block
    impl_block = (
        '  // ---- Home tab implementation (PRD §6) ----\n' +
        '\n'.join('  ' + line if line.strip() else '' for line in chunk3.split('\n')) +
        '\n\n' +
        '  // ---- Tracker + Weekly + Recovery implementation (PRD §7-9) ----\n' +
        '\n'.join('  ' + line if line.strip() else '' for line in chunk4.split('\n')) +
        '\n\n'
    )

    html = html[:idx_start] + impl_block + html[idx_end:]

    # 5. Update the window.OM exports to include new functions
    # Find the renderToday stub reference in OM and keep it (functions are now defined)
    # No changes needed since the function names match the stubs

    # 6. Write output
    out_path = os.path.join(BASE, 'public', 'index.html')
    with open(out_path, 'w') as f:
        f.write(html)

    size_kb = os.path.getsize(out_path) / 1024
    print(f"Built public/index.html ({size_kb:.0f} KB)")

if __name__ == '__main__':
    main()
