"""Impagina un video HeyGen verticale di Andrea con lo stile MiRT.
Uso: python3 impagina.py raw.mp4 sottotitoli.srt out.mp4 "Kicker" "Hook in apertura" "Testo finale" "URL finale" '["frase 1","frase 2"]' ["Kicker finale"]
Aggiunge: logo MiRT, hook nei primi 3,5 s, frasi ad effetto distribuite nel video, sottotitoli,
etichetta AI fissa, cartello finale negli ultimi 4 s."""
import sys, os, subprocess, tempfile, json
from PIL import Image, ImageDraw, ImageFont

raw, srt, out, kicker, hook, endtxt, endurl = sys.argv[1:8]
phrases = json.loads(sys.argv[8]) if len(sys.argv) > 8 else []
endkick = sys.argv[9] if len(sys.argv) > 9 else 'MiRT Radar 2027'
HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.join(HERE, '..', '..', '..', 'brand-kit')
FD = os.environ.get('MIRT_FONTS', os.path.join(HERE, 'fonts'))
MW = os.path.join(FD, 'merriweather-latin-700-normal.ttf')
AR = os.path.join(FD, 'arvo-latin-700-normal.ttf')
AR4 = os.path.join(FD, 'arvo-latin-400-normal.ttf')
INK = (61, 60, 63)
W, H = 1080, 1920
CARD_Y = 1120

dur = float(json.loads(subprocess.check_output(
    ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', raw]))['format']['duration'])
tmp = tempfile.mkdtemp()


def wrap(d, text, font, maxw):
    lines, cur = [], ''
    for w in text.split():
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) <= maxw:
            cur = t
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def card(path, kick, title, sub=None, y=CARD_Y):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    fk = ImageFont.truetype(AR, 30)
    ft = ImageFont.truetype(MW, 62)
    fs = ImageFont.truetype(AR4, 36)
    tl = wrap(d, title, ft, W - 200)
    sl = wrap(d, sub, fs, W - 200) if sub else []
    top = 50 + (54 if kick else 0)
    h = top + len(tl) * 84 + (20 + len(sl) * 50 if sl else 0) + 40
    d.rounded_rectangle([60, y, W - 60, y + h], radius=24, fill=(255, 255, 255, 245))
    if kick:
        d.text((100, y + 50), kick.upper(), font=fk, fill=(112, 113, 115))
    yy = y + top
    for line in tl:
        d.text((100, yy), line, font=ft, fill=INK)
        yy += 84
    yy += 20
    for line in sl:
        d.text((100, yy), line, font=fs, fill=INK)
        yy += 50
    im.save(path)


def chrome(path):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    logo = Image.open(os.path.join(KIT, 'logo', 'logo-mirt-600px.png')).convert('RGBA')
    logo.thumbnail((220, 120))
    d.rounded_rectangle([40, 40, 40 + logo.width + 40, 40 + logo.height + 30], radius=16, fill=(255, 255, 255, 235))
    im.alpha_composite(logo, (60, 55))
    f = ImageFont.truetype(AR4, 28)
    t = 'Video realizzato con avatar AI di Andrea Bertagnolio'
    tw = d.textlength(t, font=f)
    d.rounded_rectangle([(W - tw) / 2 - 24, H - 110, (W + tw) / 2 + 24, H - 56], radius=14, fill=(61, 60, 63, 200))
    d.text(((W - tw) / 2, H - 102), t, font=f, fill=(255, 255, 255))
    im.save(path)


card(f'{tmp}/hook.png', kicker, hook)
card(f'{tmp}/end.png', endkick, endtxt, endurl)
chrome(f'{tmp}/chrome.png')

# frasi ad effetto: distribuite tra la fine dell'hook e l'inizio del cartello finale
slots = []
if phrases:
    a, b = 4.0, dur - 4.5
    step = (b - a) / len(phrases)
    for k, ph in enumerate(phrases):
        card(f'{tmp}/ph{k}.png', '', ph)
        slots.append((a + k * step + 0.2, a + k * step + min(3.2, step - 0.2)))

ass_style = ("FontName=Arvo,FontSize=15,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H663F3C3D,BackColour=&H993F3C3D,"
             "BorderStyle=3,Outline=6,Shadow=0,Alignment=2,MarginV=40")
srt_esc = srt.replace(':', '\\:').replace("'", "\\'")
inputs = ['-i', raw, '-i', f'{tmp}/chrome.png', '-i', f'{tmp}/hook.png', '-i', f'{tmp}/end.png']
for k in range(len(slots)):
    inputs += ['-i', f'{tmp}/ph{k}.png']
fc = (f"[0:v]subtitles='{srt_esc}':fontsdir='{FD}':force_style='{ass_style}'[s];"
      f"[s][1:v]overlay=0:0[a];[a][2:v]overlay=0:0:enable='lt(t,3.5)'[b];"
      f"[b][3:v]overlay=0:0:enable='gt(t,{dur - 4:.2f})'[c0]")
for k, (t0, t1) in enumerate(slots):
    fc += f";[c{k}][{4 + k}:v]overlay=0:0:enable='between(t,{t0:.2f},{t1:.2f})'[c{k + 1}]"
last = f'c{len(slots)}'
subprocess.check_call(['ffmpeg', '-y', '-v', 'error'] + inputs + [
    '-filter_complex', fc, '-map', f'[{last}]', '-map', '0:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '24',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out])
print('ok', out)
