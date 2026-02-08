from PIL import Image, ImageFilter
import os

# Load original amulet
img = Image.open('content/panorama/images/custom_game/hud/artifact_amulet_t4.png').convert('RGBA')
pixels = img.load()
w, h = img.size

# Create output 
result = Image.new('RGBA', (w, h))
res_pixels = result.load()

# Step 1: Mark all checkerboard pixels
# Checker pixels: neutral gray (sat < 8) and brightness 0-120
checker_count = 0
fg_count = 0

for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        sat = max(r, g, b) - min(r, g, b)
        bright = (r + g + b) / 3
        
        # Pure checkerboard: very low saturation, gray range
        is_checker = (sat <= 8 and bright < 120)
        
        if is_checker:
            res_pixels[x, y] = (0, 0, 0, 0)
            checker_count += 1
        else:
            res_pixels[x, y] = (r, g, b, a)
            fg_count += 1

print(f"Removed {checker_count} checker pixels, kept {fg_count} foreground pixels")

# Step 2: Smooth edges - for foreground pixels near transparent pixels,
# reduce alpha slightly for anti-aliasing
smoothed = result.copy()
sm_pixels = smoothed.load()

for y in range(1, h-1):
    for x in range(1, w-1):
        r, g, b, a = res_pixels[x, y]
        if a == 0:
            continue
        
        # Count transparent neighbors
        trans_count = 0
        for dx, dy in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,-1),(-1,1),(1,1)]:
            nr, ng, nb, na = res_pixels[x+dx, y+dy]
            if na == 0:
                trans_count += 1
        
        # Edge pixel - soften alpha
        if trans_count >= 4:
            new_alpha = int(a * (8 - trans_count) / 8)
            sm_pixels[x, y] = (r, g, b, max(0, new_alpha))

out_path = 'content/panorama/images/custom_game/hud/artifact_amulet_t4.png'
smoothed.save(out_path, 'PNG')
sz = os.path.getsize(out_path) // 1024
print(f"Saved: {sz}KB")
