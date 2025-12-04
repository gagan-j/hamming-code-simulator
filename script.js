// --- Global state ---
const imageState = {
  image: null,
  width: 0,
  height: 0,
  selection: null, // { x, y, w, h } in original image coordinates
  selectionScale: null, // { scale, offsetX, offsetY } for selection canvas
  originalImageData: null,
  corruptedImageData: null,
  correctedImageData: null,
};

// Logical display size for selection canvas
const selectionDisplay = {
  width: 640,
  height: 420,
};

// Elements
let fileInput;
let imageInfoEl;
let selectionCanvas;
let selectionCtx;
let runButton;

let hammingStatusEl;
let hammingContentEl;

// Visualization canvases
let originalCanvas;
let originalCtx;
let corruptedCanvas;
let corruptedCtx;
let correctedCanvas;
let correctedCtx;

window.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  setupImageUpload();
  setupSelectionCanvas();
  setupRunButton();
});

// Cache DOM elements
function cacheElements() {
  fileInput = document.getElementById("image-input");
  imageInfoEl = document.getElementById("image-info");
  selectionCanvas = document.getElementById("selection-canvas");
  selectionCtx = selectionCanvas.getContext("2d");

  runButton = document.getElementById("run-simulation-btn");

  hammingStatusEl = document.getElementById("hamming-status");
  hammingContentEl = document.getElementById("hamming-content");

  originalCanvas = document.getElementById("original-canvas");
  originalCtx = originalCanvas.getContext("2d");

  corruptedCanvas = document.getElementById("corrupted-canvas");
  corruptedCtx = corruptedCanvas.getContext("2d");

  correctedCanvas = document.getElementById("corrected-canvas");
  correctedCtx = correctedCanvas.getContext("2d");
}

// --- Image upload handling ---

function setupImageUpload() {
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      onImageLoaded(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      imageInfoEl.textContent =
        "Failed to load image. Please try another file.";
    };
    img.src = url;
  });
}

function onImageLoaded(img) {
  imageState.image = img;
  imageState.width = img.naturalWidth;
  imageState.height = img.naturalHeight;

  // Use a fixed logical size for the selection canvas
  selectionCanvas.width = selectionDisplay.width;
  selectionCanvas.height = selectionDisplay.height;

  // Clear any previous selection
  imageState.selection = null;

  drawBaseImageOnSelectionCanvas();

  // Update info
  imageInfoEl.textContent = `Loaded image: ${imageState.width} × ${imageState.height} pixels. Click and drag on the image to select a region.`;

  // Disable run until user selects a region
  runButton.disabled = true;

  // Reset Hamming and output canvases
  resetHammingSection();
  clearOutputCanvases();

  // Fit output canvases to image size (internal resolution)
  setupOutputCanvasSizes();
}

// Draw scaled image onto selection canvas
function drawBaseImageOnSelectionCanvas() {
  if (!imageState.image) return;

  const imgW = imageState.width;
  const imgH = imageState.height;
  const canvasW = selectionDisplay.width;
  const canvasH = selectionDisplay.height;

  selectionCtx.clearRect(0, 0, canvasW, canvasH);

  // Fit image into canvas while keeping aspect ratio
  const scale = Math.min(canvasW / imgW, canvasH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const offsetX = (canvasW - drawW) / 2;
  const offsetY = (canvasH - drawH) / 2;

  imageState.selectionScale = { scale, offsetX, offsetY };

  selectionCtx.drawImage(imageState.image, offsetX, offsetY, drawW, drawH);
}

// --- Selection handling ---

function setupSelectionCanvas() {
  let isDragging = false;
  let dragStart = null;
  const coordsEl = document.getElementById("selection-coords");

  function getCanvasRelativePos(evt) {
    const rect = selectionCanvas.getBoundingClientRect();
    const xInCanvas =
      ((evt.clientX - rect.left) / rect.width) * selectionCanvas.width;
    const yInCanvas =
      ((evt.clientY - rect.top) / rect.height) * selectionCanvas.height;

    const s = imageState.selectionScale;
    if (!s) {
      return { x: 0, y: 0 };
    }

    // Convert from selection canvas space back to original image coordinates
    const imgX = (xInCanvas - s.offsetX) / s.scale;
    const imgY = (yInCanvas - s.offsetY) / s.scale;

    return { x: imgX, y: imgY };
  }

  selectionCanvas.addEventListener("mousedown", (evt) => {
    if (!imageState.image) return;
    isDragging = true;
    dragStart = getCanvasRelativePos(evt);
  });

  window.addEventListener("mousemove", (evt) => {
    if (!isDragging || !imageState.image) return;

    const current = getCanvasRelativePos(evt);
    const x = Math.min(dragStart.x, current.x);
    const y = Math.min(dragStart.y, current.y);
    const w = Math.abs(current.x - dragStart.x);
    const h = Math.abs(current.y - dragStart.y);

    imageState.selection = { x, y, w, h };

    drawSelectionOverlay();

    coordsEl.textContent = `Current selection: x=${x.toFixed(0)}, y=${y.toFixed(
      0
    )}, w=${w.toFixed(0)}, h=${h.toFixed(0)}`;
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;

    const sel = imageState.selection;
    if (sel && sel.w > 2 && sel.h > 2) {
      coordsEl.textContent = `Selection confirmed: x=${sel.x.toFixed(
        0
      )}, y=${sel.y.toFixed(0)}, w=${sel.w.toFixed(0)}, h=${sel.h.toFixed(
        0
      )}. Click "Confirm Selection & Run Hamming Simulation" to continue.`;
      runButton.disabled = false;
    } else {
      imageState.selection = null;
      coordsEl.textContent =
        "No valid region selected. Click and drag on the image to select a rectangle.";
      runButton.disabled = true;
      drawBaseImageOnSelectionCanvas();
    }
  });
}

// Draw selection overlay (in selection canvas space)
function drawSelectionOverlay() {
  drawBaseImageOnSelectionCanvas();
  const sel = imageState.selection;
  const s = imageState.selectionScale;
  if (!sel || !s) return;

  // Map selection from image coords to selection canvas coords
  const x = s.offsetX + sel.x * s.scale;
  const y = s.offsetY + sel.y * s.scale;
  const w = sel.w * s.scale;
  const h = sel.h * s.scale;

  selectionCtx.save();

  // Light green translucent fill
  selectionCtx.fillStyle = "rgba(187, 247, 208, 0.25)"; // soft light green
  selectionCtx.fillRect(x, y, w, h);

  // Dark green border for clear edges
  selectionCtx.strokeStyle = "rgba(22, 101, 52, 0.95)"; // dark green
  selectionCtx.lineWidth = 2;
  selectionCtx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  selectionCtx.restore();
}

// --- Run simulation ---

function setupRunButton() {
  runButton.addEventListener("click", () => {
    if (!imageState.image || !imageState.selection) return;

    runSimulation();

    // Smooth scroll to Hamming process section
    const hammingSection = document.getElementById("hamming-section");
    if (hammingSection) {
      hammingSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

function runSimulation() {
  resetHammingSection();
  hammingStatusEl.textContent = "Running simulation on the selected region...";
  hammingStatusEl.style.color = "#374151";

  // Get full original image data (color)
  const fullImageData = getOriginalImageDataFromImage();
  imageState.originalImageData = fullImageData;

  // Clone for corrupted and corrected (start as exact copies of original)
  const corrupted = new ImageData(
    new Uint8ClampedArray(fullImageData.data),
    fullImageData.width,
    fullImageData.height
  );
  const corrected = new ImageData(
    new Uint8ClampedArray(fullImageData.data),
    fullImageData.width,
    fullImageData.height
  );

  const sel = imageState.selection;
  const sx = Math.max(0, Math.floor(sel.x));
  const sy = Math.max(0, Math.floor(sel.y));
  const sw = Math.min(fullImageData.width - sx, Math.floor(sel.w));
  const sh = Math.min(fullImageData.height - sy, Math.floor(sel.h));

  const stats = {
    totalBlocks: 0,
    totalCodewords: 0,
    errorsIntroduced: 0,
    errorsCorrected: 0,
  };

  const codewordRecords = []; // store info for every (7,4) codeword in region

  // Process region pixel by pixel
  for (let y = sy; y < sy + sh; y++) {
    for (let x = sx; x < sx + sw; x++) {
      const idx = (y * fullImageData.width + x) * 4;

      const r0 = fullImageData.data[idx];
      const g0 = fullImageData.data[idx + 1];
      const b0 = fullImageData.data[idx + 2];

      // Convert this pixel to grayscale for Hamming processing
      const gray = Math.round(0.299 * r0 + 0.587 * g0 + 0.114 * b0);

      // Break into two 4-bit nibbles
      const highNibble = (gray >> 4) & 0b1111;
      const lowNibble = gray & 0b1111;

      const nibbles = [highNibble, lowNibble];
      const processedNibbles = [];

      nibbles.forEach((nibble, nibbleIndex) => {
        const dataBits = [
          (nibble >> 3) & 1,
          (nibble >> 2) & 1,
          (nibble >> 1) & 1,
          nibble & 1,
        ];

        stats.totalBlocks += 1;

        // Encode
        const codeword = hammingEncode(dataBits);
        stats.totalCodewords += 1;

        // Introduce exactly one bit error
        const bitIndex = Math.floor(Math.random() * 7); // 0..6
        const received = codeword.slice();
        received[bitIndex] = received[bitIndex] ^ 1;
        stats.errorsIntroduced += 1;

        // Decode
        const decodeResult = hammingDecode(received);

        if (decodeResult.errorPosition > 0) {
          stats.errorsCorrected += 1;
        }

        const decodedBits = decodeResult.dataBits;
        const newNibble =
          (decodedBits[0] << 3) |
          (decodedBits[1] << 2) |
          (decodedBits[2] << 1) |
          decodedBits[3];

        const record = {
          x,
          y,
          nibbleIndex,
          gray,
          dataBits,
          codeword,
          received,
          errorBitIndex: bitIndex,
          decodeResult,
        };

        processedNibbles.push({
          originalNibble: nibble,
          newNibble,
          ...record,
        });

        codewordRecords.push(record);
      });

      // Build new grayscale value from decoded nibbles
      const newGray =
        (processedNibbles[0].newNibble << 4) | processedNibbles[1].newNibble;

      // Corrupted image: approximate a corrupted gray from received data bits
      const corruptedHighBits =
        (processedNibbles[0].received[0] << 3) |
        (processedNibbles[0].received[1] << 2) |
        (processedNibbles[0].received[2] << 1) |
        processedNibbles[0].received[3];
      const corruptedLowBits =
        (processedNibbles[1].received[0] << 3) |
        (processedNibbles[1].received[1] << 2) |
        (processedNibbles[1].received[2] << 1) |
        processedNibbles[1].received[3];
      const corruptedGray = (corruptedHighBits << 4) | corruptedLowBits;

      // Write into corrupted image data (selected region only)
      corrupted.data[idx] = corruptedGray;
      corrupted.data[idx + 1] = corruptedGray;
      corrupted.data[idx + 2] = corruptedGray;

      // Write into corrected image data (selected region only)
      corrected.data[idx] = newGray;
      corrected.data[idx + 1] = newGray;
      corrected.data[idx + 2] = newGray;
    }
  }

  imageState.corruptedImageData = corrupted;
  imageState.correctedImageData = corrected;

  // Render images
  renderOutputCanvases();

  // Update Hamming details
  if (codewordRecords.length > 0) {
    fillHammingDetails(codewordRecords, stats, { sx, sy, sw, sh });
    hammingStatusEl.textContent =
      "Simulation completed. All matrices and codewords below are live from the selected region.";
    hammingStatusEl.style.color = "#047857";
  } else {
    hammingStatusEl.textContent =
      "Selection region is too small. Please select a larger area.";
    hammingStatusEl.style.color = "#b91c1c";
  }
}

// Get original image data (no grayscale conversion).
function getOriginalImageDataFromImage() {
  const w = imageState.width;
  const h = imageState.height;

  originalCanvas.width = w;
  originalCanvas.height = h;
  originalCtx.drawImage(imageState.image, 0, 0, w, h);

  return originalCtx.getImageData(0, 0, w, h);
}

// --- Hamming (7,4) core functions ---

// Using standard (7,4) Hamming with parity bits in positions 1,2,4.
// Data bits [d1, d2, d3, d4] form codeword [p1, p2, d1, p3, d2, d3, d4]

function hammingEncode(dataBits) {
  const [d1, d2, d3, d4] = dataBits.map((b) => b & 1);

  const p1 = d1 ^ d2 ^ d4; // parity for positions 1,3,5,7
  const p2 = d1 ^ d3 ^ d4; // parity for positions 2,3,6,7
  const p3 = d2 ^ d3 ^ d4; // parity for positions 4,5,6,7

  // codeword positions 1..7
  return [p1, p2, d1, p3, d2, d3, d4];
}

function hammingDecode(received) {
  // received is array [b1..b7]
  const b = received.map((bit) => bit & 1);
  const [b1, b2, b3, b4, b5, b6, b7] = b;

  // Calculate syndrome bits
  const s1 = b1 ^ b3 ^ b5 ^ b7; // checks parity 1
  const s2 = b2 ^ b3 ^ b6 ^ b7; // checks parity 2
  const s3 = b4 ^ b5 ^ b6 ^ b7; // checks parity 3

  const syndromeBits = [s1, s2, s3];
  // Syndrome interpreted as binary index (s3 s2 s1)
  const errorPosition = s1 + (s2 << 1) + (s3 << 2); // 0..7

  const corrected = b.slice();
  if (errorPosition >= 1 && errorPosition <= 7) {
    corrected[errorPosition - 1] ^= 1;
  }

  // Extract data bits from corrected codeword: positions 3,5,6,7
  const dataBits = [corrected[2], corrected[4], corrected[5], corrected[6]];

  return {
    dataBits,
    syndromeBits,
    errorPosition,
    correctedCodeword: corrected,
  };
}

// --- Hamming details UI ---

function resetHammingSection() {
  hammingContentEl.classList.add("hidden");
  hammingStatusEl.style.color = "#6b7280";
}

function fillHammingDetails(codewordRecords, stats, regionInfo) {
  hammingContentEl.classList.remove("hidden");

  // 1) Region summary
  const totalPixels = regionInfo.sw * regionInfo.sh;

  document.getElementById("summary-total-pixels").textContent = totalPixels;
  document.getElementById("summary-total-blocks").textContent =
    stats.totalBlocks;
  document.getElementById("summary-total-codewords").textContent =
    stats.totalCodewords;
  document.getElementById("summary-errors-introduced").textContent =
    stats.errorsIntroduced;
  document.getElementById("summary-errors-corrected").textContent =
    stats.errorsCorrected;

  // 2) Code definition matrices G and H (fixed for whole region)
  const G = [
    [1, 0, 0, 0, 1, 1, 0], // d1
    [0, 1, 0, 0, 1, 0, 1], // d2
    [0, 0, 1, 0, 1, 0, 0], // d3
    [0, 0, 0, 1, 0, 1, 1], // d4
  ];

  const H = [
    [1, 0, 1, 0, 1, 0, 1],
    [0, 1, 1, 0, 0, 1, 1],
    [0, 0, 0, 1, 1, 1, 1],
  ];

  renderMatrix("matrix-G", G);
  renderMatrix("matrix-H", H);

  // 3) Codeword inspector
  const inspectorRangeEl = document.getElementById("inspector-range");
  const indexInput = document.getElementById("codeword-index-input");

  inspectorRangeEl.textContent = `You can inspect codeword indices from 1 to ${codewordRecords.length}.`;

  const clampIndex = (val) => {
    if (val < 1) return 1;
    if (val > codewordRecords.length) return codewordRecords.length;
    return val;
  };

  function renderInspectorForIndex(idx1Based) {
    const idx = clampIndex(idx1Based) - 1;
    indexInput.value = idx + 1;

    const rec = codewordRecords[idx];
    if (!rec) return;

    const {
      x,
      y,
      nibbleIndex,
      gray,
      dataBits,
      codeword,
      received,
      errorBitIndex,
      decodeResult,
    } = rec;

    // Pixel & gray info
    document.getElementById("insp-coords").textContent = `(${x}, ${y})`;
    document.getElementById("insp-nibble-index").textContent =
      nibbleIndex === 0
        ? "High nibble (bits b7–b4)"
        : "Low nibble (bits b3–b0)";

    document.getElementById("insp-gray-value").textContent = gray;

    const grayBits = gray.toString(2).padStart(8, "0").split("").join(" ");
    document.getElementById("insp-gray-bits").textContent = grayBits;

    // Hamming details
    document.getElementById("insp-data-bits").textContent = dataBits.join(" ");
    document.getElementById("insp-codeword-C").textContent = codeword.join(" ");
    document.getElementById("insp-error-bit-index").textContent =
      errorBitIndex + 1;
    document.getElementById("insp-received-r").textContent = received.join(" ");

    const S = decodeResult.syndromeBits;
    document.getElementById("insp-syndrome-S").textContent = S.join(" ");
    document.getElementById("insp-error-position").textContent =
      decodeResult.errorPosition;
    document.getElementById("insp-corrected-codeword").textContent =
      decodeResult.correctedCodeword.join(" ");
    document.getElementById("insp-decoded-data-bits").textContent =
      decodeResult.dataBits.join(" ");
  }

  // Initial render
  renderInspectorForIndex(1);

  // On input change
  indexInput.addEventListener("input", () => {
    const val = parseInt(indexInput.value, 10);
    if (Number.isNaN(val)) return;
    renderInspectorForIndex(val);
  });
}

// Render a small binary matrix into a container by id
function renderMatrix(containerId, matrix) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  const table = document.createElement("table");
  table.className = "matrix-table";

  matrix.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((val) => {
      const td = document.createElement("td");
      td.textContent = val;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  container.appendChild(table);
}

// --- Output canvases ---

function setupOutputCanvasSizes() {
  if (!imageState.image) return;
  const w = imageState.width;
  const h = imageState.height;

  [originalCanvas, corruptedCanvas, correctedCanvas].forEach((c) => {
    c.width = w;
    c.height = h;
  });
}

function renderOutputCanvases() {
  if (!imageState.originalImageData) return;

  originalCtx.putImageData(imageState.originalImageData, 0, 0);

  if (imageState.corruptedImageData) {
    corruptedCtx.putImageData(imageState.corruptedImageData, 0, 0);
  } else {
    clearCanvas(corruptedCtx, corruptedCanvas);
  }

  if (imageState.correctedImageData) {
    correctedCtx.putImageData(imageState.correctedImageData, 0, 0);
  } else {
    clearCanvas(correctedCtx, correctedCanvas);
  }
}

function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function clearOutputCanvases() {
  clearCanvas(originalCtx, originalCanvas);
  clearCanvas(corruptedCtx, corruptedCanvas);
  clearCanvas(correctedCtx, correctedCanvas);
}
