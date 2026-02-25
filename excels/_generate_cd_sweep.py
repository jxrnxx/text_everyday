# -*- coding: utf-8 -*-
"""Generate a 48x48 x 60-frame cooldown sweep spritesheet.
Each frame is a semi-transparent black pie slice covering ratio% of the circle.
Frame 0 = fully covered (100% CD), Frame 59 = almost empty (close to 0% CD).
Output: cd_sweep_spritesheet.png  (horizontal strip: 60 frames × 48px wide = 2880px × 48px)
"""
from PIL import Image, ImageDraw
import math, os

FRAME_SIZE = 48
NUM_FRAMES = 60
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       '..', 'content', 'panorama', 'images', 'hud')
os.makedirs(OUT_DIR, exist_ok=True)

sheet = Image.new('RGBA', (FRAME_SIZE * NUM_FRAMES, FRAME_SIZE), (0, 0, 0, 0))

for i in range(NUM_FRAMES):
    # ratio = how much of the circle is STILL covered (dark)
    # frame 0 → ratio=1.0 (fully dark)
    # frame 59 → ratio ≈ 0.017 (almost clear)
    ratio = 1.0 - (i / NUM_FRAMES)
    
    frame = Image.new('RGBA', (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    
    if ratio <= 0:
        # fully revealed — blank frame
        pass
    elif ratio >= 1.0:
        # fully dark
        draw.rectangle([0, 0, FRAME_SIZE-1, FRAME_SIZE-1], fill=(0, 0, 0, 192))
    else:
        # Draw a pie slice covering `ratio` of the circle, starting from 12 o'clock, clockwise.
        # PIL's pieslice uses counter-clockwise angles from 3 o'clock.
        # We want clockwise from 12 o'clock.
        # "covered" angle in degrees = ratio * 360
        # The "revealed" sector starts at 12 o'clock (top) and goes clockwise by (1-ratio)*360.
        # So the "dark" sector covers from the end of the revealed sector back to 12 o'clock.
        #
        # In PIL coords: 0° = 3 o'clock, 90° = 6 o'clock, angles go counter-clockwise for negative.
        # 12 o'clock in PIL = -90° (or 270°).
        # Revealed sector: from -90° (12 o'clock) going clockwise = going in negative PIL direction
        # = from -90° to -90° - revealDeg° in PIL coords... complicated.
        #
        # Simpler: draw the dark sector as a filled polygon.
        # Dark sector: from reveal_end to 12 o'clock (going clockwise to complete the circle)
        # = from 12 o'clock + reveal_angle to 12 o'clock + 360°
        
        reveal_deg = (1.0 - ratio) * 360.0  # how many degrees revealed (clockwise from 12)
        dark_start_angle = reveal_deg  # degrees clockwise from 12 o'clock where dark starts
        dark_end_angle = 360.0  # dark ends at 12 o'clock (completing the circle)
        
        cx, cy = FRAME_SIZE / 2, FRAME_SIZE / 2
        r = FRAME_SIZE  # use larger radius to ensure full coverage
        
        # Build polygon: center, then arc points from dark_start to dark_end (clockwise from 12)
        points = [(cx, cy)]
        steps = 64  # enough segments for smooth arc
        for j in range(steps + 1):
            # angle in "clockwise from 12 o'clock" system
            a_cw = dark_start_angle + (dark_end_angle - dark_start_angle) * j / steps
            # Convert to standard math angle (counter-clockwise from 3 o'clock, in radians)
            a_rad = math.radians(a_cw - 90)  # -90 shifts 12 o'clock to 0
            px = cx + r * math.cos(a_rad)
            py = cy + r * math.sin(a_rad)
            points.append((px, py))
        
        draw.polygon(points, fill=(0, 0, 0, 192))
    
    sheet.paste(frame, (i * FRAME_SIZE, 0))

out_path = os.path.join(OUT_DIR, 'cd_sweep_spritesheet.png')
sheet.save(out_path)
print(f'Saved spritesheet: {out_path}')
print(f'Size: {sheet.size[0]}x{sheet.size[1]}px, {NUM_FRAMES} frames')
