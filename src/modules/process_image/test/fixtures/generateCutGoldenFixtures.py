#!/usr/bin/env python3
"""Generate .cut fixtures and golden RGB for CutPatternConverter.

ayab-desktop's CutPatternConverter.parse_color does not return updated pos/column
to the caller (infinite loop). This generator builds the same file layout as
desktop's intended format and computes RGB the way desktop output_im + greyscale
palette / .pal decoding would, matching the Valdi TypeScript port which fixed
the parse-position bug.
"""

from __future__ import annotations

import base64
import json
import struct
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


def build_solid_cut(width: int, height: int, color: int) -> bytes:
    row_chunks: list[bytes] = []
    for _ in range(height):
        body = bytes([0x80 | (width & 0x7F), color & 0xFF, 0x00])
        row_chunks.append(struct.pack("<H", len(body)) + body)
    return struct.pack("<HHBB", width, height, 0, 0) + b"".join(row_chunks)


def build_checker_cut(width: int, height: int, color_a: int, color_b: int) -> bytes:
    row_chunks: list[bytes] = []
    for row in range(height):
        body = bytearray()
        body.append(width & 0x7F)
        for col in range(width):
            body.append(color_a if (row + col) % 2 == 0 else color_b)
        body.append(0x00)
        row_chunks.append(struct.pack("<H", len(body)) + bytes(body))
    return struct.pack("<HHBB", width, height, 0, 0) + b"".join(row_chunks)


def build_palette(color_max_index: int, entries: list[tuple[int, int, int]]) -> bytes:
    size = max(40 + color_max_index * 3, 64)
    buf = bytearray(size)
    buf[0:2] = b"AH"
    buf[6] = 0x0A
    buf[7] = 0x00
    struct.pack_into("<H", buf, 12, color_max_index)
    for i, (r, g, b) in enumerate(entries):
        index = 40 + i * 3
        buf[index] = r
        buf[index + 1] = g
        buf[index + 2] = b
    return bytes(buf)


def get_word(data: bytes, i: int) -> int:
    return data[i] | (data[i + 1] << 8)


def parse_cut_color_pattern(data: bytes) -> tuple[int, int, list[list[int]]]:
    """Fixed cut RLE decode (mirrors Valdi CutPatternConverter)."""
    width = get_word(data, 0)
    height = get_word(data, 2)
    assert data[4] == 0 and data[5] == 0
    pattern = [[0] * width for _ in range(height)]
    pos = 6
    for row in range(height):
        row_end = pos + 2 + get_word(data, pos)
        pos += 2
        column = 0
        while True:
            byte = data[pos]
            pos += 1
            run = byte & 0x7F
            if run == 0:
                assert pos == row_end
                break
            if byte & 0x80:
                color = data[pos]
                pos += 1
                for _ in range(run):
                    pattern[row][column] = color
                    column += 1
            else:
                for _ in range(run):
                    pattern[row][column] = data[pos]
                    pos += 1
                    column += 1
    return width, height, pattern


def decode_pal(pal: bytes) -> dict[int, tuple[int, int, int]]:
    assert pal[0:2] == b"AH"
    assert pal[6] == 0x0A and pal[7] == 0x00
    color_max = get_word(pal, 12)
    colors: dict[int, tuple[int, int, int]] = {}
    block = 0
    offset = 0
    for cs in range(color_max):
        if offset + 3 > 512:
            offset = 0
            block += 512
        index = 40 + block + offset
        colors[cs] = (pal[index], pal[index + 1], pal[index + 2])
        offset += 3
    return colors


def pattern_to_rgb(
    pattern: list[list[int]],
    colors: dict[int, tuple[int, int, int]],
) -> list[int]:
    """Match desktop output_im: bottom row first."""
    height = len(pattern)
    width = len(pattern[0]) if height else 0
    rgb: list[int] = []
    for row in range(height):
        src = height - row - 1
        for column in range(width):
            r, g, b = colors[pattern[src][column]]
            rgb.extend([r, g, b])
    return rgb


def golden_for_cut(
    cut_data: bytes, pal_data: bytes | None = None
) -> dict[str, object]:
    width, height, pattern = parse_cut_color_pattern(cut_data)
    used = {c for row in pattern for c in row}
    if pal_data is None:
        colors = {c: (c, c, c) for c in used}
    else:
        colors = decode_pal(pal_data)
        for c in used:
            if c not in colors:
                colors[c] = (c, c, c)
    return {
        "width": width,
        "height": height,
        "rgb": pattern_to_rgb(pattern, colors),
    }


def main() -> None:
    greyscale = {
        "grey_2x2": build_solid_cut(2, 2, 128),
        "black_3x2": build_solid_cut(3, 2, 0),
        "checker_4x4": build_checker_cut(4, 4, 0, 255),
    }
    palette = build_palette(2, [(255, 0, 0), (0, 0, 255)])
    red_solid = build_solid_cut(2, 2, 0)

    golden_map: dict[str, dict[str, object]] = {}

    for name, data in greyscale.items():
        cut_path = SCRIPT_DIR / f"{name}.cut"
        cut_path.write_bytes(data)
        golden = golden_for_cut(data)
        (SCRIPT_DIR / f"{name}.cut.golden.json").write_text(
            json.dumps(golden, indent=2) + "\n"
        )
        golden_map[name] = {
            **golden,
            "base64": base64.b64encode(data).decode("ascii"),
            "byteLength": len(data),
            "paletteBase64": None,
            "paletteByteLength": 0,
        }
        print(f"wrote {cut_path.name} ({len(data)} bytes)")

    name = "red_2x2_pal"
    cut_path = SCRIPT_DIR / f"{name}.cut"
    pal_path = SCRIPT_DIR / f"{name}.pal"
    cut_path.write_bytes(red_solid)
    pal_path.write_bytes(palette)
    golden = golden_for_cut(red_solid, palette)
    (SCRIPT_DIR / f"{name}.cut.golden.json").write_text(
        json.dumps(golden, indent=2) + "\n"
    )
    golden_map[name] = {
        **golden,
        "base64": base64.b64encode(red_solid).decode("ascii"),
        "byteLength": len(red_solid),
        "paletteBase64": base64.b64encode(palette).decode("ascii"),
        "paletteByteLength": len(palette),
    }
    print(f"wrote {cut_path.name} + {pal_path.name}")

    ts_lines = [
        "/** Auto-generated by generateCutGoldenFixtures.py — do not edit by hand. */",
        "",
        "export interface CutGoldenFixture {",
        "  width: number;",
        "  height: number;",
        "  rgb: readonly number[];",
        "  base64: string;",
        "  byteLength: number;",
        "  paletteBase64: string | null;",
        "  paletteByteLength: number;",
        "}",
        "",
        "export const cutGoldenFixtures = {",
    ]
    for name, golden in golden_map.items():
        ts_lines.append(f"  {name}: {{")
        ts_lines.append(f"    width: {golden['width']},")
        ts_lines.append(f"    height: {golden['height']},")
        ts_lines.append(f"    rgb: {json.dumps(golden['rgb'])},")
        ts_lines.append(f"    base64: {json.dumps(golden['base64'])},")
        ts_lines.append(f"    byteLength: {golden['byteLength']},")
        ts_lines.append(
            f"    paletteBase64: {json.dumps(golden['paletteBase64'])},"
        )
        ts_lines.append(f"    paletteByteLength: {golden['paletteByteLength']},")
        ts_lines.append("  },")
    ts_lines.append("} as const satisfies Record<string, CutGoldenFixture>;")
    ts_lines.append("")
    ts_lines.append(
        "export function decodeCutFixtureBase64(base64: string): Uint8Array {"
    )
    ts_lines.append("  const binary = atob(base64);")
    ts_lines.append("  const bytes = new Uint8Array(binary.length);")
    ts_lines.append("  for (let i = 0; i < binary.length; i++) {")
    ts_lines.append("    bytes[i] = binary.charCodeAt(i);")
    ts_lines.append("  }")
    ts_lines.append("  return bytes;")
    ts_lines.append("}")
    ts_lines.append("")

    out_ts = SCRIPT_DIR / "cutGoldenFixtures.ts"
    out_ts.write_text("\n".join(ts_lines))
    print(f"wrote {out_ts.name}")


if __name__ == "__main__":
    main()
