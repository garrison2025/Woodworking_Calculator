#!/usr/bin/env python3
"""Deterministic 1200×630 PNG share artwork; standard library only.

This is a generic branded OG illustration, not a photograph, a construction
plan, or a rendered/certified 1:1 cutting diagram. Generated during Pages
build to avoid a network, Pillow or binary GitHub upload dependency.
"""
from __future__ import annotations
import struct
import zlib
from pathlib import Path

WIDTH, HEIGHT = 1200, 630
COLORS = (
    (244, 247, 239),  # warm paper
    (27, 62, 49),     # forest ink
    (217, 233, 214),  # diagram panel
    (184, 143, 97),   # copper reference
    (195, 208, 195),  # line grid
    (71, 103, 86),    # subtle text
)
# Five-column, seven-row bitmap alphabet: intentionally distinctive
# technical-drawing lettering, readable in social thumbnail previews.
FONT = {
"A":("01110","10001","10001","11111","10001","10001","10001"),
"B":("11110","10001","10001","11110","10001","10001","11110"),
"C":("01111","10000","10000","10000","10000","10000","01111"),
"D":("11110","10001","10001","10001","10001","10001","11110"),
"E":("11111","10000","10000","11110","10000","10000","11111"),
"F":("11111","10000","10000","11110","10000","10000","10000"),
"G":("01111","10000","10000","10111","10001","10001","01111"),
"H":("10001","10001","10001","11111","10001","10001","10001"),
"I":("11111","00100","00100","00100","00100","00100","11111"),
"J":("00111","00010","00010","00010","10010","10010","01100"),
"K":("10001","10010","10100","11000","10100","10010","10001"),
"L":("10000","10000","10000","10000","10000","10000","11111"),
"M":("10001","11011","10101","10101","10001","10001","10001"),
"N":("10001","11001","10101","10011","10001","10001","10001"),
"O":("01110","10001","10001","10001","10001","10001","01110"),
"P":("11110","10001","10001","11110","10000","10000","10000"),
"Q":("01110","10001","10001","10001","10101","10010","01101"),
"R":("11110","10001","10001","11110","10100","10010","10001"),
"S":("01111","10000","10000","01110","00001","00001","11110"),
"T":("11111","00100","00100","00100","00100","00100","00100"),
"U":("10001","10001","10001","10001","10001","10001","01110"),
"V":("10001","10001","10001","10001","10001","01010","00100"),
"W":("10001","10001","10001","10101","10101","10101","01010"),
"X":("10001","10001","01010","00100","01010","10001","10001"),
"Y":("10001","10001","01010","00100","00100","00100","00100"),
"Z":("11111","00001","00010","00100","01000","10000","11111"),
"0":("01110","10001","10011","10101","11001","10001","01110"),
"1":("00100","01100","00100","00100","00100","00100","01110"),
"2":("01110","10001","00001","00010","00100","01000","11111"),
"3":("11110","00001","00001","01110","00001","00001","11110"),
"4":("00010","00110","01010","10010","11111","00010","00010"),
"5":("11111","10000","10000","11110","00001","00001","11110"),
"6":("01110","10000","10000","11110","10001","10001","01110"),
"7":("11111","00001","00010","00100","01000","01000","01000"),
"8":("01110","10001","10001","01110","10001","10001","01110"),
"9":("01110","10001","10001","01111","00001","00001","01110"),
".":("00000","00000","00000","00000","00000","01100","01100"),
"/":("00001","00001","00010","00100","01000","10000","10000"),
"-":("00000","00000","00000","11111","00000","00000","00000"),
"&":("01100","10010","10100","01000","10101","10010","01101"),
":":("00000","01100","01100","00000","01100","01100","00000"),
" ":("00000",)*7,
}

def generate(path: str | Path) -> None:
    pixels = bytearray([0]) * (WIDTH * HEIGHT)
    def rect(x0, y0, x1, y1, color):
        x0, x1 = max(0, int(x0)), min(WIDTH, int(x1))
        y0, y1 = max(0, int(y0)), min(HEIGHT, int(y1))
        if x0 >= x1 or y0 >= y1:
            return
        line = bytes([color]) * (x1-x0)
        for y in range(y0, y1):
            start = y*WIDTH+x0
            pixels[start:start+(x1-x0)] = line
    def line(x0, y0, x1, y1, color, weight=2):
        x0,y0,x1,y1=map(int,(x0,y0,x1,y1))
        dx=abs(x1-x0);dy=-abs(y1-y0);sx=1 if x0<x1 else -1;sy=1 if y0<y1 else -1
        err=dx+dy
        while True:
            rect(x0-weight//2,y0-weight//2,x0-weight//2+weight,y0-weight//2+weight,color)
            if x0==x1 and y0==y1:break
            e=2*err
            if e>=dy:err+=dy;x0+=sx
            if e<=dx:err+=dx;y0+=sy
    def label(x,y,word,scale,color=1):
        for char in word.upper():
            for ry,bits in enumerate(FONT.get(char,FONT[" "])):
                for cx,c in enumerate(bits):
                    if c=="1":rect(x+cx*scale,y+ry*scale,x+(cx+1)*scale,y+(ry+1)*scale,color)
            x+=6*scale
    rect(0,0,WIDTH,15,1)
    rect(0,0,20,HEIGHT,1)
    for x in range(610,WIDTH,32):line(x,20,x,HEIGHT-1,4,1)
    for y in range(25,HEIGHT,32):line(600,y,WIDTH-1,y,4,1)
    rect(646,68,1142,572,2)
    rect(651,73,1137,567,0)
    rect(661,83,1127,557,2)
    # A blueprint-like rake-wall diagram with stud positions and slope,
    # intentionally schematic and not physically scaled or certified.
    line(708,478,1085,478,1,8)
    line(1085,478,1085,192,1,8)
    line(708,478,1085,192,1,8)
    line(720,420,1069,217,3,5)
    for x in (774,834,894,954,1014):
        upper=int(478-(x-708)*286/377)
        line(x,478,x,upper,3,7)
    line(706,510,1087,510,5,2)
    line(706,500,706,520,5,2)
    line(1087,500,1087,520,5,2)
    # Technical font in palette index, not dependent on system fonts.
    label(76,86,"WOODLAYOUT",7,1)
    rect(77,186,139,195,3)
    label(77,231,"WOODWORKING",8,1)
    label(77,304,"CALCULATORS",8,1)
    label(77,408,"MEASURED LAYOUTS",5,5)
    label(77,452,"CLEAR DIAGRAMS",5,5)
    line(77,533,562,533,4,2)
    label(77,550,"31 FREE TOOLS / WOODLAYOUT.COM",3,1)
    label(715,121,"GEOMETRY WORKBENCH",3,5)
    label(830,534,"REFERENCE DRAWING",3,5)
    raw = b"".join(b"\\x00" + pixels[y*WIDTH:(y+1)*WIDTH] for y in range(HEIGHT))
    def chunk(kind, data):
        return struct.pack(">I",len(data))+kind+data+struct.pack(">I",zlib.crc32(kind+data)&0xffffffff)
    palette = bytes(channel for rgb in COLORS for channel in rgb)
    png = (b"\\x89PNG\\r\\n\\x1a\\n" + chunk(b"IHDR",struct.pack(">IIBBBBB",WIDTH,HEIGHT,8,3,0,0,0))
           + chunk(b"PLTE",palette) + chunk(b"IDAT",zlib.compress(raw,9)) + chunk(b"IEND",b""))
    Path(path).write_bytes(png)

if __name__ == "__main__":
    generate(Path(__file__).resolve().parents[1] / "social-card-preview.png")
