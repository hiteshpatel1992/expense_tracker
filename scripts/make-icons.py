import struct
import zlib
from pathlib import Path


def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path: Path, size: int, pixels: list[tuple[int, int, int]]) -> None:
    raw = b"".join(
        b"\x00" + b"".join(bytes(px) for px in pixels[y * size : (y + 1) * size])
        for y in range(size)
    )
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def draw(size: int) -> list[tuple[int, int, int]]:
    rust = (180, 71, 42)
    cream = (244, 239, 228)
    teal = (42, 107, 99)
    ink = (28, 25, 20)
    pixels: list[tuple[int, int, int]] = []
    pad = int(size * 0.12)
    inner = size - pad * 2
    for y in range(size):
        for x in range(size):
            color = rust
            if pad <= x < size - pad and pad <= y < size - pad:
                color = cream
                ly = y - pad
                # ledger rules
                if inner > 0 and ly % max(inner // 7, 8) < max(size // 64, 2) and ly > inner * 0.18:
                    color = (217, 208, 192)
                # teal spine on the left
                if x - pad < max(size // 18, 6):
                    color = teal
                # rust amount block top-right
                if x > size * 0.62 and y < size * 0.38 and x < size - pad and y > pad:
                    color = rust
                # ink title bar
                if pad < y < pad + max(size // 16, 8) and pad + max(size // 16, 6) < x < size * 0.55:
                    color = ink
            pixels.append(color)
    return pixels


out = Path("public/icons")
out.mkdir(parents=True, exist_ok=True)
for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
    write_png(out / name, size, draw(size))
    print("wrote", name)
