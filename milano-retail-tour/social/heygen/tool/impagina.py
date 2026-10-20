"""Impagina un video HeyGen verticale di Andrea con lo stile MiRT.
Uso: python3 impagina.py raw.mp4 sottotitoli.srt out.mp4 "Kicker" "Hook in apertura" "Testo finale" "URL finale"
Aggiunge: logo MiRT, hook nei primi 3,5 s, sottotitoli, etichetta AI fissa, cartello finale negli ultimi 4 s."""
import sys, os, subprocess, tempfile, json
from PIL import Image, ImageDraw, ImageFont
raw, srt, out, kicker, hook, endtxt, endurl = sys.argv[1:8]
HERE=os.path.dirname(os.path.abspath(__file__))
KIT=os.path.join(HERE,'..','..','..','brand-kit')
FD=os.environ.get('MIRT_FONTS', os.path.join(HERE,'fonts'))
MW=os.path.join(FD,'merriweather-latin-700-normal.ttf'); AR=os.path.join(FD,'arvo-latin-700-normal.ttf'); AR4=os.path.join(FD,'arvo-latin-400-normal.ttf')
INK=(61,60,63); W,H=1080,1920
dur=float(json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',raw]))['format']['duration'])
tmp=tempfile.mkdtemp()
def wrap(d,text,font,maxw):
    lines=[];cur=''
    for w in text.split():
        t=(cur+' '+w).strip()
        if d.textlength(t,font=font)<=maxw: cur=t
        else: lines.append(cur); cur=w
    lines.append(cur); return lines
def card(path,kick,title,sub=None,y=170):
    im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    fk=ImageFont.truetype(AR,30); ft=ImageFont.truetype(MW,62); fs=ImageFont.truetype(AR4,36)
    tl=wrap(d,title,ft,W-200); sl=wrap(d,sub,fs,W-200) if sub else []
    h=60+44+len(tl)*84+(20+len(sl)*50 if sl else 0)+50
    d.rounded_rectangle([60,y,W-60,y+h],radius=24,fill=(255,255,255,245))
    d.text((100,y+50),kick.upper(),font=fk,fill=(112,113,115)); yy=y+104
    for l in tl: d.text((100,yy),l,font=ft,fill=INK); yy+=84
    yy+=20
    for l in sl: d.text((100,yy),l,font=fs,fill=INK); yy+=50
    im.save(path)
def chrome(path):
    im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    logo=Image.open(os.path.join(KIT,'logo','logo-mirt-600px.png')).convert('RGBA'); logo.thumbnail((220,120))
    d.rounded_rectangle([40,40,40+logo.width+40,40+logo.height+30],radius=16,fill=(255,255,255,235)); im.alpha_composite(logo,(60,55))
    f=ImageFont.truetype(AR4,28); t='Video realizzato con avatar AI di Andrea Bertagnolio'
    tw=d.textlength(t,font=f); d.rounded_rectangle([(W-tw)/2-24,H-110,(W+tw)/2+24,H-56],radius=14,fill=(61,60,63,200)); d.text(((W-tw)/2,H-102),t,font=f,fill=(255,255,255))
    im.save(path)
card(f'{tmp}/hook.png',kicker,hook,y=1120)
card(f'{tmp}/end.png','MiRT Radar 2027',endtxt,endurl,y=1120)
chrome(f'{tmp}/chrome.png')
ass_style=("FontName=Arvo,FontSize=15,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H663F3C3D,BackColour=&H993F3C3D,"
           "BorderStyle=3,Outline=6,Shadow=0,Alignment=2,MarginV=40")
srt_esc=srt.replace(':','\\:').replace("'","\\'")
fc=(f"[0:v]subtitles='{srt_esc}':fontsdir='{FD}':force_style='{ass_style}'[s];"
    f"[s][1:v]overlay=0:0[a];[a][2:v]overlay=0:0:enable='lt(t,3.5)'[b];[b][3:v]overlay=0:0:enable='gt(t,{dur-4:.2f})'[v]")
subprocess.check_call(['ffmpeg','-y','-v','error','-i',raw,'-i',f'{tmp}/chrome.png','-i',f'{tmp}/hook.png','-i',f'{tmp}/end.png',
  '-filter_complex',fc,'-map','[v]','-map','0:a','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',out])
print('ok',out)
