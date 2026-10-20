# 生成 EveryBite APP 图标（复刻用户提供的餐盘设计）
# 输出: assets/icon-1024.png (方形完整图标), assets/icon-foreground.png (自适应图标前景, 透明底)
from PIL import Image, ImageDraw

S = 1024
BG = (110, 122, 87, 255)       # 橄榄绿底
CREAM = (241, 237, 223, 255)   # 米白餐盘
OLIVE = (94, 109, 74, 255)     # 深橄榄绿(餐具/环/叶)
ORANGE = (217, 143, 76, 255)   # 橙色(胡萝卜/爱心)
ORANGE_D = (199, 126, 62, 255) # 胡萝卜纹理

def rounded(d, box, r, fill):
    d.rounded_rectangle(box, radius=r, fill=fill)

def draw_art(d):
    cx, cy = S // 2, S // 2
    # 餐盘
    d.ellipse([cx-445, cy-445, cx+445, cy+445], fill=CREAM)
    d.ellipse([cx-392, cy-392, cx+392, cy+392], outline=OLIVE, width=14)

    # ---- 叉子 (左, 中心 x=305) ----
    fx = 305
    tine_w, tine_gap = 26, 18
    tines_top, tines_bot = 235, 400
    total = 4 * tine_w + 3 * tine_gap
    x0 = fx - total // 2
    for i in range(4):
        x = x0 + i * (tine_w + tine_gap)
        rounded(d, [x, tines_top, x + tine_w, tines_bot], tine_w // 2, OLIVE)
    rounded(d, [x0, 380, x0 + total, 418], 19, OLIVE)          # 横档
    rounded(d, [fx-19, 400, fx+19, 735], 19, OLIVE)            # 手柄

    # ---- 勺子 (右, 中心 x=719) ----
    sx = 719
    d.ellipse([sx-68, 225, sx+68, 405], fill=OLIVE)            # 勺头
    rounded(d, [sx-19, 390, sx+19, 735], 19, OLIVE)            # 手柄

    # ---- 胡萝卜 (中心) ----
    top_w, top_y, tip_y = 118, 478, 775
    d.polygon([(cx-top_w//2, top_y), (cx+top_w//2, top_y), (cx, tip_y)], fill=ORANGE)
    d.ellipse([cx-top_w//2, top_y-16, cx+top_w//2, top_y+28], fill=ORANGE)  # 圆顶
    for i, yy in enumerate((540, 600, 660)):                   # 纹理
        w = (52, 44, 34)[i]
        xoff = (-8, 6, -4)[i]
        rounded(d, [cx+xoff-w//2, yy, cx+xoff+w//2, yy+16], 8, ORANGE_D)
    # 叶子(三根, 带圆头)
    for (ex, ey) in ((cx-52, 385), (cx, 360), (cx+52, 385)):
        d.line([cx, top_y+6, ex, ey], fill=OLIVE, width=26)
        d.ellipse([ex-15, ey-15, ex+15, ey+15], fill=OLIVE)

    # ---- 爱心 (胡萝卜上方) ----
    hx, hy = cx, 285
    d.ellipse([hx-70, hy-38, hx-4, hy+28], fill=ORANGE)
    d.ellipse([hx+4, hy-38, hx+70, hy+28], fill=ORANGE)
    d.polygon([(hx-64, hy+8), (hx+64, hy+8), (hx, hy+82)], fill=ORANGE)

# 1) 完整方形图标
img = Image.new("RGBA", (S, S), BG)
draw_art(ImageDraw.Draw(img))
img.save("assets/icon-1024.png")

# 2) 自适应图标前景: 透明底, 图案缩到 62% 居中(安全区)
art = Image.new("RGBA", (S, S), (0, 0, 0, 0))
draw_art(ImageDraw.Draw(art))
inner = art.resize((int(S*0.62), int(S*0.62)), Image.LANCZOS)
fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
fg.paste(inner, ((S-inner.width)//2, (S-inner.height)//2), inner)
fg.save("assets/icon-foreground.png")

# 3) 圆形版(旧系统圆图标遮罩预览用)
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).ellipse([0, 0, S, S], fill=255)
rnd = Image.new("RGBA", (S, S), (0, 0, 0, 0))
rnd.paste(img, (0, 0), mask)
rnd.save("assets/icon-round.png")

print("done: assets/icon-1024.png, icon-foreground.png, icon-round.png")
