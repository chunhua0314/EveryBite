# 从 assets/ 图标素材生成安卓各密度 mipmap PNG
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

LAUNCHER = {  # ic_launcher.png / ic_launcher_round.png 尺寸
    'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192,
}
FOREGROUND = {  # 自适应图标前景（108dp 体系）
    'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432,
}

def gen(src_name, out_name, sizes):
    src = Image.open(os.path.join(ASSETS, src_name)).convert('RGBA')
    for density, px in sizes.items():
        out_dir = os.path.join(RES, f'mipmap-{density}')
        os.makedirs(out_dir, exist_ok=True)
        img = src.resize((px, px), Image.LANCZOS)
        img.save(os.path.join(out_dir, out_name))
        print(f'mipmap-{density}/{out_name} {px}x{px}')

gen('icon-1024.png', 'ic_launcher.png', LAUNCHER)
gen('icon-round.png', 'ic_launcher_round.png', LAUNCHER)
gen('icon-foreground.png', 'ic_launcher_foreground.png', FOREGROUND)
print('done')
