#!/usr/bin/env python3
"""Generate .stp fixtures and golden RGB output via ayab-desktop StpPatternConverter."""

from __future__ import annotations

import base64
import json
import os
import struct
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = Path(__file__).resolve().parents[5]

COLOR_BLOCK_START = 0xF8
MAX_XOR_LEN = 21000
COLOR_DATA_SIZE = 0x47 * 0x19


def resolve_ayab_desktop_main() -> Path | None:
    env_path = os.environ.get("AYAB_DESKTOP_PATH")
    if env_path:
        candidate = Path(env_path)
        if candidate.exists():
            return candidate

    candidates = [
        REPO_ROOT.parent / "ayab-desktop" / "src" / "main" / "python" / "main",
        REPO_ROOT / "ayab-desktop" / "src" / "main" / "python" / "main",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


AYAB_MAIN = resolve_ayab_desktop_main()
if AYAB_MAIN is None:
    print(
        "error: ayab-desktop Python sources not found.\n"
        "Clone ayab-desktop as a sibling of ayab-valdi, or set AYAB_DESKTOP_PATH.",
        file=sys.stderr,
    )
    sys.exit(1)
sys.path.insert(0, str(AYAB_MAIN))

from ayab.pattern_import import StpPatternConverter  # noqa: E402


def get_byte_at(data: bytes, i: int) -> int:
    return data[i] & 0xFF


def get_word_at(data: bytes, i: int) -> int:
    return get_byte_at(data, i) + (get_byte_at(data, i + 1) << 8)


def get_dword_at(data: bytes, i: int) -> int:
    return get_word_at(data, i) + (get_word_at(data, i + 2) << 16)


def get_string_at(data: bytes, i: int) -> bytes:
    size = get_byte_at(data, i)
    return data[i + 1 : i + size + 1]


def append_key_string(existing: bytes, next_string: bytes, max_size: int) -> bytes:
    return (existing + next_string)[:max_size]


def calc_stp_xor_key(data: bytes) -> bytearray:
    key1 = (get_dword_at(data, 0x35) >> 1) + (get_word_at(data, 0x3F) << 2)
    key1 += get_dword_at(data, 0x39) + get_word_at(data, 0x3D) + get_byte_at(data, 0x20)

    salt1 = get_word_at(data, 0x39)
    salt2 = int((get_dword_at(data, 0x35) & 0xFFFF) > 0)
    keystring: bytes = get_string_at(data, 0x60)
    keystring = append_key_string(keystring, get_string_at(data, 0x41), 0x6E)
    keystring = append_key_string(keystring, str(get_word_at(data, 0x3D)).encode(), 0x7D)
    keystring = append_key_string(keystring, str(get_byte_at(data, 0x20)).encode(), 0x8C)
    keystring = append_key_string(keystring, get_string_at(data, 0x41), 0xAA)
    keystring = append_key_string(keystring, str(get_byte_at(data, 0x20)).encode(), 0xB9)
    keystring = append_key_string(keystring, str(get_word_at(data, 0x3D)).encode(), 0xC8)

    key2 = key1
    for i in range(len(keystring)):
        b = keystring[i] // 2
        switch = (i + 1) % 3
        if switch == 0:
            temp = (salt2 + b) // 7
            key2 += (i + 1) * b + temp
        elif switch == 1:
            temp = b // 5 * get_word_at(data, 0x3F)
            key2 += (i + 1) * salt2 + b * 6 + temp
        else:
            key2 += (i + 1) * salt1 + b * 4

    keystring = str(key2 * 3).encode()
    keystring = append_key_string(keystring, str(key2).encode(), 0x1E)
    keystring = append_key_string(keystring, str(key2 * 4).encode(), 0x2D)
    keystring = append_key_string(keystring, str(key2 * 2).encode(), 0x3C)
    keystring = append_key_string(keystring, str(key2 * 5).encode(), 0x4B)
    keystring = append_key_string(keystring, str(key2 * 6).encode(), 0x5A)
    keystring = append_key_string(keystring, str(key2 * 8).encode(), 0x69)
    keystring = append_key_string(keystring, str(key2 * 7).encode(), 0x78)

    xorkey = bytearray(MAX_XOR_LEN)
    for i in range(MAX_XOR_LEN):
        index = (i + 1) % len(keystring)
        temp1 = keystring[index] & 0xFF
        temp2 = key2 % (i + 1) & 0xFF
        xorkey[i] = temp1 ^ temp2
    return xorkey


def rle_solid_rows(width: int, height: int, color_index: int) -> bytes:
    row = bytes([0x80 | width, color_index])
    return row * height


def encrypt_block(height: int, plaintext: bytes, xorkey: bytearray) -> bytes:
    encrypted = bytes(plaintext[i] ^ xorkey[i] for i in range(len(plaintext)))
    return struct.pack("<HH", height, len(plaintext)) + encrypted


def make_color_entry(symbol: int, r: int, g: int, b: int) -> bytes:
    block = bytearray(0x1A)
    block[0] = 0x10
    block[1] = symbol
    block[6] = r
    block[7] = g
    block[8] = b
    return bytes(block)


def build_solid_stp(
    width: int,
    height: int,
    color_index: int,
    rgb: tuple[int, int, int],
) -> bytes:
    color_plain = rle_solid_rows(width, height, color_index)
    stitch_plain = rle_solid_rows(width, height, 0)

    color_data = bytearray(COLOR_DATA_SIZE)
    entry = make_color_entry(color_index, *rgb)
    color_data[color_index * 0x19 : color_index * 0x19 + len(entry)] = entry

    total_size = COLOR_BLOCK_START + 4 + len(color_plain) + 4 + len(stitch_plain) + COLOR_DATA_SIZE
    buf = bytearray(total_size)
    buf[0:3] = b"D7c"
    struct.pack_into("<H", buf, 3, width)
    struct.pack_into("<H", buf, 5, height)

    # Stable header fields for xor key generation.
    buf[0x20] = 1
    struct.pack_into("<I", buf, 0x35, 0x100)
    struct.pack_into("<H", buf, 0x39, 2)
    struct.pack_into("<I", buf, 0x39, 2)
    struct.pack_into("<H", buf, 0x3D, 4)
    struct.pack_into("<H", buf, 0x3F, 3)
    buf[0x41] = 3
    buf[0x42:0x45] = b"key"
    buf[0x60] = 2
    buf[0x61:0x63] = b"ab"

    xorkey = calc_stp_xor_key(bytes(buf))
    pos = COLOR_BLOCK_START
    color_enc = encrypt_block(height, color_plain, xorkey)
    buf[pos : pos + len(color_enc)] = color_enc
    pos += len(color_enc)
    stitch_enc = encrypt_block(height, stitch_plain, xorkey)
    buf[pos : pos + len(stitch_enc)] = stitch_enc
    pos += len(stitch_enc)
    buf[pos : pos + COLOR_DATA_SIZE] = color_data
    return bytes(buf)


def golden_from_stp(data: bytes) -> dict[str, object]:
    path = SCRIPT_DIR / "_tmp_golden.stp"
    path.write_bytes(data)
    try:
        image = StpPatternConverter(debug=False).pattern2im(str(path))
        rgb = list(image.tobytes())
        return {"width": image.width, "height": image.height, "rgb": rgb}
    finally:
        path.unlink(missing_ok=True)


def main() -> None:
    fixtures = {
        "minimal_red_2x2": build_solid_stp(2, 2, 1, (255, 0, 0)),
        "blue_3x2": build_solid_stp(3, 2, 1, (0, 128, 255)),
        "green_4x4": build_solid_stp(4, 4, 1, (0, 255, 0)),
    }

    golden_map: dict[str, dict[str, object]] = {}
    for name, data in fixtures.items():
        stp_path = SCRIPT_DIR / f"{name}.stp"
        stp_path.write_bytes(data)
        golden = golden_from_stp(data)
        golden_path = SCRIPT_DIR / f"{name}.stp.golden.json"
        golden_path.write_text(json.dumps(golden, indent=2) + "\n")
        golden_map[name] = {
            **golden,
            "base64": base64.b64encode(data).decode("ascii"),
            "byteLength": len(data),
        }
        print(f"wrote {stp_path.name} ({len(data)} bytes)")

    ts_lines = [
        "/** Auto-generated by generateStpGoldenFixtures.py — do not edit by hand. */",
        "",
        "export interface StpGoldenFixture {",
        "  width: number;",
        "  height: number;",
        "  rgb: readonly number[];",
        "  base64: string;",
        "  byteLength: number;",
        "}",
        "",
        "export const stpGoldenFixtures = {",
    ]
    for name, golden in golden_map.items():
        ts_lines.append(f"  {name}: {{")
        ts_lines.append(f"    width: {golden['width']},")
        ts_lines.append(f"    height: {golden['height']},")
        ts_lines.append(f"    rgb: {json.dumps(golden['rgb'])},")
        ts_lines.append(f"    base64: {json.dumps(golden['base64'])},")
        ts_lines.append(f"    byteLength: {golden['byteLength']},")
        ts_lines.append("  },")
    ts_lines.append("} as const satisfies Record<string, StpGoldenFixture>;")
    ts_lines.append("")
    ts_lines.append(
        "export function decodeStpFixtureBase64(base64: string): Uint8Array {"
    )
    ts_lines.append("  const binary = atob(base64);")
    ts_lines.append("  const bytes = new Uint8Array(binary.length);")
    ts_lines.append("  for (let i = 0; i < binary.length; i++) {")
    ts_lines.append("    bytes[i] = binary.charCodeAt(i);")
    ts_lines.append("  }")
    ts_lines.append("  return bytes;")
    ts_lines.append("}")
    ts_lines.append("")

    out_ts = SCRIPT_DIR / "stpGoldenFixtures.ts"
    out_ts.write_text("\n".join(ts_lines))
    print(f"wrote {out_ts.name}")


if __name__ == "__main__":
    main()
