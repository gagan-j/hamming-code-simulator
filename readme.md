# Hamming (7,4) Image Simulator

A web app that demonstrates how the **Hamming (7,4)** error-correcting code works on **grayscale image data**.

You can:

- Upload a PNG or JPEG image.
- Select a rectangular region.
- Add one random bit error per Hamming codeword inside that region.
- See how Hamming (7,4) detects and corrects errors.
- Inspect every single codeword used in the selected region.

Built with **plain HTML, CSS, and JavaScript** (no frameworks).

---

## Live Demo

**Live URL:**  
https://hamming-image-simulator.vercel.app

---

## Features

### Image upload

- Upload `.png` or `.jpg`.
- UI layout stays stable even for very large or tall images.
- Image is processed at full resolution internally.

### Region selection

- The uploaded image is shown on a selection canvas.
- Click and drag to select a rectangle.
- Selection is drawn with:
  - Soft green translucent fill.
  - Dark green border.
- Coordinates are stored in **original image pixel space**.
- After a valid selection, the button:

> **Confirm Selection & Run Hamming Simulation**

is enabled and auto-scrolls to the Hamming section when clicked.

### Hamming (7,4) processing

For every pixel inside the selected region:

1. Convert RGB → grayscale (0–255).
2. Split the 8-bit grayscale value into two 4-bit nibbles.
3. For each 4-bit block:
   - Encode using Hamming (7,4) to a 7-bit codeword.
   - Flip exactly **one random bit** in the codeword.
   - Decode with Hamming (7,4) (single-bit correction).
4. Rebuild:
   - A **corrupted grayscale** pixel from the noisy codewords.
   - A **corrected grayscale** pixel from the decoded codewords.

Pixels outside the selection remain unchanged.

### Hamming matrices (G and H)

The app displays the actual matrices used:

- Generator matrix `G` (4×7).
- Parity-check matrix `H` (3×7).

These match the encode/decode implementation.

### Codeword inspector

A **Codeword Inspector** lets you inspect any codeword (1-based index) from the region:

- Pixel coordinates `(x, y)`.
- Whether it is the high nibble (`b7–b4`) or low nibble (`b3–b0`).
- Original grayscale value and its 8-bit binary representation.
- Data bits `D` (4 bits).
- Codeword `C` (7 bits) before noise.
- Which bit (1–7) was flipped.
- Received word `r`.
- Syndrome `S` and decoded error position.
- Corrected codeword.
- Decoded data bits.

All values are computed from real data in the selected region.

### Image visualization

Three canvases:

- **Original** image.
- **Corrupted** image (selected region only).
- **Corrected** image (selected region only).

---

## Project Structure

```text
.
├─ index.html   # Main page
├─ style.css    # Styling (neutral with green accents)
└─ script.js    # Logic: image handling, selection, Hamming, rendering
```

(No favicon file is required.)

---

## How It Works (Short)

1. **Upload image**

   - Image is drawn to a canvas.
   - Pixel data is read using `getImageData`.

2. **Selection mapping**

   - Selection canvas uses the same resolution as the image.
   - Mouse positions are mapped from screen → canvas → original image coordinates (1:1).

3. **Hamming processing**

   - For each pixel `(x, y)` in the region:
     - Convert to grayscale `g`.
     - Split `g` into two 4-bit nibbles.
     - Encode each nibble via Hamming (7,4).
     - Flip one random bit.
     - Decode and correct.
     - Build:
       - Corrupted grayscale from noisy data bits.
       - Corrected grayscale from decoded data bits.

4. **Rendering**
   - Original, corrupted, and corrected images are written back to three canvases with `putImageData`.

---

## Running Locally

### Open directly

- Open `index.html` in a modern browser.

If your browser blocks some features with `file://`, use a local server.

### Local server (Node.js)

```bash
# From project folder
npx serve .
# or
npx http-server .
```

Open the URL shown in the terminal.

---

## Deploying

- Repo is deployed as a static site on Vercel.
- Live URL: https://hamming-image-simulator.vercel.app

---

## Technologies

- HTML5 Canvas
- Vanilla JavaScript (ES6)
- CSS3
- Hamming (7,4) error-correcting code

---

## Authors

- 1CR233C059

- 1CR233C002
- 1CR23EC043
