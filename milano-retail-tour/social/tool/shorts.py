# Short verticali 1080x1920 dai caroselli: ogni slide sulla mappa di Milano, 3,5 s a slide, dissolvenza 0,5 s.
# Uso: python3 tool/shorts.py <uscita.mp4> <slide1.jpg> <slide2.jpg> ...
import sys, subprocess, tempfile, os
from PIL import Image, ImageEnhance
here = os.path.dirname(os.path.abspath(__file__))
mappa = Image.open(os.path.join(here, '../../brand-kit/immagini/sfondo-mappa-milano.jpg')).convert('RGB')
out, slides = sys.argv[1], sys.argv[2:]
W, H, D, F = 1080, 1920, 3.5, 0.5
s = max(W / mappa.width, H / mappa.height)
bg = mappa.resize((int(mappa.width * s) + 1, int(mappa.height * s) + 1))
bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))
tmp = tempfile.mkdtemp()
frames = []
for i, f in enumerate(slides):
    im = bg.copy(); im.paste(Image.open(f).convert('RGB'), (0, (H - 1080) // 2))
    p = os.path.join(tmp, f'{i:02d}.png'); im.save(p); frames.append(p)
cmd = ['ffmpeg', '-y', '-loglevel', 'error']
for p in frames: cmd += ['-loop', '1', '-t', str(D), '-i', p]
cmd += ['-f', 'lavfi', '-t', str(D * len(frames) - F * (len(frames) - 1)), '-i', 'anullsrc=r=44100:cl=stereo']
chain, last = [], '[0:v]'
for i in range(1, len(frames)):
    off = i * (D - F)
    chain.append(f'{last}[{i}:v]xfade=transition=fade:duration={F}:offset={off:.2f}[v{i}]'); last = f'[v{i}]'
fc = ';'.join(chain) + f';{last}format=yuv420p[vout]' if chain else f'[0:v]format=yuv420p[vout]'
cmd += ['-filter_complex', fc, '-map', '[vout]', '-map', f'{len(frames)}:a', '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', out]
subprocess.run(cmd, check=True)
print('ok', out)
