"""Chroma-key 去背工具：把纯色背景(默认品红 #FF00FF)的 AI 生成图转为透明 PNG。

用法: uv run --with pillow scripts/remove_bg.py <in.png> <out.png> [--height 256] [--bg ff00ff]
步骤: 色距软阈值抠像 -> 边缘去色晕(despill) -> 裁剪内容包围盒 -> 缩放到目标高度
"""
import argparse
import sys

from PIL import Image


def parse_hex(s: str) -> tuple[int, int, int]:
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def key_out(img: Image.Image, bg: tuple[int, int, int]) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    br, bgc, bb = bg
    hard = 90   # 色距 <= hard 视为纯背景
    soft = 170  # 色距 >= soft 视为完全前景，之间线性过渡
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = ((r - br) ** 2 + (g - bgc) ** 2 + (b - bb) ** 2) ** 0.5
            if d <= hard:
                px[x, y] = (r, g, b, 0)
            elif d < soft:
                alpha = int(255 * (d - hard) / (soft - hard))
                # 边缘半透明像素做去色晕：把偏洋红的颜色往绿色方向压
                if r > g + 30 and b > g + 30:
                    avg = (g + min(r, b)) // 2
                    r = min(r, avg)
                    b = min(b, avg)
                px[x, y] = (r, g, b, min(a, alpha))
    return img


def crop_content(img: Image.Image, pad: int = 8) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    return img.crop((max(0, l - pad), max(0, t - pad), min(img.width, r + pad), min(img.height, b + pad)))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--height", type=int, default=256)
    ap.add_argument("--bg", default="ff00ff")
    args = ap.parse_args()

    img = Image.open(args.src)
    img = key_out(img, parse_hex(args.bg))
    img = crop_content(img)
    if img.height > args.height:
        ratio = args.height / img.height
        img = img.resize((max(1, round(img.width * ratio)), args.height), Image.LANCZOS)
    img.save(args.dst)
    print(f"OK {args.dst} {img.width}x{img.height}")
    sys.exit(0)


if __name__ == "__main__":
    main()
