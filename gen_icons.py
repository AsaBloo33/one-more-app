#!/usr/bin/env python3
"""Generate app icons using only stdlib (no PIL)."""
import struct, zlib, os, math

BASE = os.path.dirname(os.path.abspath(__file__))

def make_png(width, height, pixels):
    """Create a PNG file from RGBA pixel data."""
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))

    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter: None
        for x in range(width):
            r, g, b, a = pixels[y * width + x]
            raw += struct.pack('BBBB', r, g, b, a)

    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend


def draw_icon(size):
    """Draw the One More '+' icon at given size."""
    bg = (0x17, 0x24, 0x3F, 255)      # Ink
    fg = (0xDF, 0xF4, 0x78, 255)      # Accent
    primary = (0x78, 0x8C, 0xE3, 255)  # Primary (for subtle ring)

    pixels = [bg] * (size * size)
    cx, cy = size / 2, size / 2

    # Plus sign proportions
    arm_len = size * 0.30   # half-length of each arm
    arm_w = size * 0.11     # half-width of each arm
    corner_r = size * 0.04  # corner radius for rounded ends

    def in_rounded_rect(px, py, rx, ry, rw, rh, rad):
        """Check if point is inside a rounded rectangle."""
        # Clamp to inner rect
        cx = max(rx + rad, min(px, rx + rw - rad))
        cy = max(ry + rad, min(py, ry + rh - rad))
        dx = px - cx
        dy = py - cy
        return dx * dx + dy * dy <= rad * rad

    def in_plus(px, py):
        # Horizontal bar
        hx = cx - arm_len
        hy = cy - arm_w
        hw = arm_len * 2
        hh = arm_w * 2
        # Vertical bar
        vx = cx - arm_w
        vy = cy - arm_len
        vw = arm_w * 2
        vh = arm_len * 2

        in_h = (hx <= px <= hx + hw) and (hy <= py <= hy + hh)
        in_v = (vx <= px <= vx + vw) and (vy <= py <= vy + vh)

        if in_h or in_v:
            # Check rounded corners on the 4 tips
            r = corner_r
            tips = [
                (hx, hy, hw, hh),  # horizontal bar
                (vx, vy, vw, vh),  # vertical bar
            ]
            for rx, ry, rw, rh in tips:
                if (rx <= px <= rx + rw) and (ry <= py <= ry + rh):
                    return in_rounded_rect(px, py, rx, ry, rw, rh, r)
            return False
        return False

    for y in range(size):
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            if in_plus(px, py):
                pixels[y * size + x] = fg

    return pixels


def main():
    out = os.path.join(BASE, 'public')
    for size, name in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
        print(f'Generating {name} ({size}x{size})...')
        px = draw_icon(size)
        data = make_png(size, size, px)
        path = os.path.join(out, name)
        with open(path, 'wb') as f:
            f.write(data)
        print(f'  -> {len(data)} bytes')

    print('Done.')


if __name__ == '__main__':
    main()
