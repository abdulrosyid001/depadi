/**
 * DePadi — Rice Disease Detection Website
 * Interactive JavaScript — UI Logic & Detection Simulation
 */

// =============================================
// Disease Database
// =============================================
const DISEASE_DB = {
  leafblast: {
    name: "Leaf Blast",
    latin: "Magnaporthe oryzae",
    description:
      "Penyakit blas daun (Leaf Blast) disebabkan oleh jamur Magnaporthe oryzae. Gejalanya berupa lesi berbentuk belah ketupat atau mata-mata dengan pusat abu-abu dan tepi cokelat gelap. Penyakit ini menyebar cepat terutama pada kelembaban tinggi dan suhu 20-30°C. Pengendalian dapat dilakukan dengan penggunaan varietas tahan blas, fungisida berbahan aktif trisiklazol atau isoprotiolan, dan pengaturan jarak tanam yang baik.",
    color: "#ef4444",
  },
  brownspot: {
    name: "Brown Spot",
    latin: "Helminthosporium oryzae",
    description:
      "Bercak cokelat (Brown Spot) disebabkan oleh jamur Helminthosporium oryzae (Bipolaris oryzae). Gejala berupa bercak oval kecil berwarna cokelat dengan pusat keabu-abuan. Penyakit ini terkait dengan kekurangan nutrisi terutama kalium. Pengendalian meliputi pemupukan berimbang, perlakuan benih dengan fungisida, dan penggunaan varietas tahan.",
    color: "#d97706",
  },
  bacterialblight: {
    name: "Bacterial Blight",
    latin: "Xanthomonas oryzae pv. oryzae",
    description:
      "Hawar daun bakteri (Bacterial Blight) disebabkan oleh bakteri Xanthomonas oryzae. Gejala berupa lesi kuning-putih yang dimulai dari ujung atau tepi daun, kemudian mengering dan berubah warna menjadi cokelat keabu-abuan. Pengendalian meliputi penggunaan varietas tahan, menghindari pemupukan nitrogen berlebihan, dan sanitasi lahan.",
    color: "#dc2626",
  },
  tungro: {
    name: "Tungro",
    latin: "Rice Tungro Bacilliform Virus & Rice Tungro Spherical Virus",
    description:
      "Penyakit tungro disebabkan oleh dua virus yang ditularkan oleh wereng hijau (Nephotettix virescens). Gejala berupa perubahan warna daun menjadi kuning-oranye dari ujung, tanaman menjadi kerdil, dan anakan berkurang. Pengendalian meliputi penggunaan varietas tahan tungro, pengendalian vektor wereng hijau, dan tanam serempak.",
    color: "#ea580c",
  },
  hispa: {
    name: "Hispa",
    latin: "Dicladispa armigera",
    description:
      "Kerusakan hispa disebabkan oleh kumbang Dicladispa armigera. Larva membuat terowongan di dalam daun menghasilkan garis-garis putih paralel, sementara kumbang dewasa mengikis permukaan daun. Serangan berat menyebabkan daun mengering dan menurunkan fotosintesis. Pengendalian dengan memotong daun terserang, insektisida, dan menjaga kebersihan lahan.",
    color: "#ca8a04",
  },
  healthy: {
    name: "Healthy (Sehat)",
    latin: "Oryza sativa",
    description:
      "Daun padi dalam kondisi sehat menunjukkan warna hijau segar yang merata, permukaan daun halus dengan urat daun sejajar yang jelas. Tidak terdapat bercak, perubahan warna abnormal, atau kerusakan fisik. Pertahankan kondisi ini dengan pemupukan berimbang, pengairan yang tepat, dan pemantauan rutin.",
    color: "#22c55e",
  },
};

const DISEASE_KEYS = Object.keys(DISEASE_DB);

// =============================================
// Navbar Scroll Effect
// =============================================
const navbar = document.getElementById("navbar");
let lastScroll = 0;

window.addEventListener("scroll", () => {
  const currentScroll = window.scrollY;
  if (currentScroll > 50) {
    navbar.classList.add("scrolled");
  } else {
    navbar.classList.remove("scrolled");
  }
  lastScroll = currentScroll;
});

// =============================================
// Active Nav Link Tracking
// =============================================
const sections = document.querySelectorAll("section");
const navLinks = document.querySelectorAll(".nav-links a:not(.nav-cta)");

const observerOptions = {
  root: null,
  rootMargin: "-40% 0px -40% 0px",
  threshold: 0,
};

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute("id");
      navLinks.forEach((link) => {
        link.classList.remove("active");
        if (link.getAttribute("href") === `#${id}`) {
          link.classList.add("active");
        }
      });
    }
  });
}, observerOptions);

sections.forEach((section) => sectionObserver.observe(section));

// =============================================
// Mobile Menu
// =============================================
const mobileToggle = document.getElementById("mobileToggle");
const navLinksContainer = document.getElementById("navLinks");

mobileToggle.addEventListener("click", () => {
  mobileToggle.classList.toggle("active");
  navLinksContainer.classList.toggle("open");
});

// Close mobile menu on link click
navLinksContainer.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mobileToggle.classList.remove("active");
    navLinksContainer.classList.remove("open");
  });
});

// =============================================
// Fade-In Animation on Scroll
// =============================================
const fadeElements = document.querySelectorAll(".fade-in");

const fadeObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        fadeObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

fadeElements.forEach((el) => fadeObserver.observe(el));

// =============================================
// Image Upload & Detection
// =============================================
const uploadZone = document.getElementById("uploadZone");
const fileInput = document.getElementById("fileInput");
const uploadPreview = document.getElementById("uploadPreview");
const previewImg = document.getElementById("previewImg");
const btnDetect = document.getElementById("btnDetect");
const btnReset = document.getElementById("btnReset");

// Result elements
const resultPlaceholder = document.getElementById("resultPlaceholder");
const loadingSpinner = document.getElementById("loadingSpinner");
const resultContent = document.getElementById("resultContent");
const resultMain = document.getElementById("resultMain");
const resultDisease = document.getElementById("resultDisease");
const confidenceBarFill = document.getElementById("confidenceBarFill");
const confidenceValue = document.getElementById("confidenceValue");
const resultBars = document.getElementById("resultBars");
const diseaseInfoCard = document.getElementById("diseaseInfoCard");
const diseaseInfoTitle = document.getElementById("diseaseInfoTitle");
const diseaseInfoText = document.getElementById("diseaseInfoText");

let selectedFile = null;

// Error & Anomaly elements
const resultError = document.getElementById("resultError");
const errorTitle = document.getElementById("errorTitle");
const errorMessage = document.getElementById("errorMessage");
const btnRetry = document.getElementById("btnRetry");
const resultAnomaly = document.getElementById("resultAnomaly");

// GradCAM elements
const gradcamOriginal = document.getElementById("gradcamOriginal");
const gradcamHeatmap = document.getElementById("gradcamHeatmap");
const gradcamOverlay = document.getElementById("gradcamOverlay");
const gradcamProcess = document.getElementById("gradcamProcess");
const gradcamGrid = document.getElementById("gradcamGrid");
const gradcamDemo = document.getElementById("gradcamDemo");
const gradcamDemoCanvas = document.getElementById("gradcamDemoCanvas");
const loadingSub = document.getElementById("loadingSub");

// Drag & Drop
uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("drag-over");
});

uploadZone.addEventListener("dragleave", () => {
  uploadZone.classList.remove("drag-over");
});

uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");
  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].type.startsWith("image/")) {
    handleFile(files[0]);
  }
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
});

function handleFile(file) {
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    uploadZone.classList.add("has-image");
    btnDetect.disabled = false;
    btnReset.style.display = "inline-flex";
  };
  reader.readAsDataURL(file);
}

// Reset
btnReset.addEventListener("click", () => {
  selectedFile = null;
  previewImg.src = "";
  uploadZone.classList.remove("has-image");
  fileInput.value = "";
  btnDetect.disabled = true;
  btnReset.style.display = "none";

  resultContent.classList.remove("show");
  loadingSpinner.classList.remove("show");
  resultError.style.display = "none";
  resultAnomaly.style.display = "none";
  resultPlaceholder.style.display = "flex";

  // Clear GradCAM canvases & restore demo placeholder
  [gradcamOriginal, gradcamHeatmap, gradcamOverlay].forEach((canvas) => {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
  gradcamGrid.style.display = "none";
  gradcamDemo.style.display = "flex";
});

// =============================================
// Backend API Configuration
// =============================================
const API_BASE_URL = "http://localhost:5000";
let backendAvailable = null; // null = unknown, true/false after check

/**
 * Check if the backend server is available.
 */
async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Backend connected:", data);
      backendAvailable = true;
      return true;
    }
  } catch (e) {
    console.warn("⚠️ Backend not available:", e.message);
  }
  backendAvailable = false;
  return false;
}

// Check backend on page load
checkBackendHealth();

// =============================================
// Detection — Backend Only
// =============================================
btnDetect.addEventListener("click", async () => {
  if (!selectedFile) return;

  // Hide placeholder, error, anomaly, show loading
  resultPlaceholder.style.display = "none";
  resultError.style.display = "none";
  resultAnomaly.style.display = "none";
  resultContent.classList.remove("show");
  loadingSpinner.classList.add("show");
  loadingSub.textContent = "Menghubungkan ke server AI...";

  // Always attempt backend
  await detectWithBackend();
});

// Retry button handler
btnRetry.addEventListener("click", () => {
  if (!selectedFile) return;
  btnDetect.click();
});

/**
 * Send image to the real backend API for prediction.
 */
async function detectWithBackend() {
  try {
    loadingSub.textContent = "Mengirim gambar ke server AI...";

    const formData = new FormData();
    formData.append("image", selectedFile);

    // Update loading messages
    const loadingSteps = [
      { text: "Ekstraksi fitur Swin Transformer Large...", delay: 1500 },
      { text: "Menghitung GradCAM heatmap...", delay: 3000 },
      { text: "Klasifikasi MLP...", delay: 5000 },
    ];

    // Start loading message rotation
    let loadingTimer = null;
    let stepIndex = 0;
    loadingTimer = setInterval(() => {
      if (stepIndex < loadingSteps.length) {
        loadingSub.textContent = loadingSteps[stepIndex].text;
        stepIndex++;
      }
    }, 1500);

    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      body: formData,
    });

    clearInterval(loadingTimer);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    loadingSpinner.classList.remove("show");
    loadingSub.textContent = "";

    showBackendResult(data);
  } catch (error) {
    console.error("❌ Backend prediction failed:", error);
    
    // Reset backend status
    backendAvailable = false;
    
    loadingSpinner.classList.remove("show");
    loadingSub.textContent = "";
    
    // Show error message
    showError(
      "Backend Tidak Tersedia",
      error.message.includes("Failed to fetch") || error.message.includes("NetworkError") || error.message.includes("Load failed")
        ? "Pastikan server backend (app.py) sudah berjalan di http://localhost:5000. Jalankan: python app.py"
        : `Error: ${error.message}`
    );
  }
}

/**
 * Display results from real backend API response.
 */
function showBackendResult(data) {
  const { predictions, top_prediction, gradcam, is_anomaly } = data;

  if (is_anomaly) {
    resultAnomaly.style.display = "flex";
    return;
  }

  // Map label to DISEASE_DB key
  const topKey = top_prediction.label;
  const disease = DISEASE_DB[topKey] || {
    name: top_prediction.display_name,
    color: "#6366f1",
    description: "Informasi penyakit tidak tersedia.",
  };

  // Update main result
  resultDisease.textContent = disease.name;
  resultDisease.style.color = disease.color;

  const confPct = (top_prediction.confidence * 100).toFixed(1);
  confidenceValue.textContent = `${confPct}%`;
  confidenceBarFill.style.width = `${confPct}%`;

  // Style result box
  resultMain.className = "result-main";
  if (topKey === "healthy") {
    resultMain.classList.add("healthy");
  } else {
    resultMain.classList.add("diseased");
  }

  // Update probability bars (predictions are already sorted by backend)
  resultBars.innerHTML = "";
  predictions.forEach((item, index) => {
    const pct = (item.confidence * 100).toFixed(1);
    const itemDisease = DISEASE_DB[item.label] || { name: item.label };
    const div = document.createElement("div");
    div.className = "result-bar-item";
    div.innerHTML = `
      <span class="name">${itemDisease.name}</span>
      <div class="bar">
        <div class="bar-fill ${index === 0 ? "top" : ""}" style="width: 0%"></div>
      </div>
      <span class="pct">${pct}%</span>
    `;
    resultBars.appendChild(div);

    // Animate bar
    requestAnimationFrame(() => {
      setTimeout(() => {
        div.querySelector(".bar-fill").style.width = `${pct}%`;
      }, 100 * index);
    });
  });

  // Update disease info
  diseaseInfoTitle.textContent = `Informasi: ${disease.name}`;
  diseaseInfoText.textContent = disease.description;

  // Show result
  resultContent.classList.add("show");

  // Display GradCAM from backend
  if (gradcam) {
    displayBackendGradCAM(gradcam);
  } else {
    // Fallback to client-side GradCAM simulation
    generateGradCAM(topKey);
  }
}

/**
 * Display GradCAM images received from the backend (base64 PNG).
 */
function displayBackendGradCAM(gradcam) {
  const SIZE = 224;

  // Hide demo, show grid
  gradcamDemo.style.display = "none";
  gradcamGrid.style.display = "grid";

  // Helper: draw base64 image onto canvas
  function drawBase64OnCanvas(base64Data, canvas) {
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
    };
    img.src = `data:image/png;base64,${base64Data}`;
  }

  // Draw original, heatmap, overlay
  drawBase64OnCanvas(gradcam.original, gradcamOriginal);
  drawBase64OnCanvas(gradcam.heatmap, gradcamHeatmap);
  drawBase64OnCanvas(gradcam.overlay, gradcamOverlay);
}

/**
 * Show error message in the result panel.
 */
function showError(title, message) {
  resultPlaceholder.style.display = "none";
  resultContent.classList.remove("show");
  loadingSpinner.classList.remove("show");
  
  errorTitle.textContent = title;
  errorMessage.textContent = message;
  resultError.style.display = "flex";
}

// =============================================
// GradCAM Heatmap Generation (Client-side Fallback)
// =============================================

/**
 * Jet colormap: maps value 0..1 to [R, G, B] like OpenCV/matplotlib jet.
 */
function jetColormap(value) {
  let r, g, b;
  if (value < 0.125) {
    r = 0;
    g = 0;
    b = 0.5 + value * 4;
  } else if (value < 0.375) {
    r = 0;
    g = (value - 0.125) * 4;
    b = 1;
  } else if (value < 0.625) {
    r = (value - 0.375) * 4;
    g = 1;
    b = 1 - (value - 0.375) * 4;
  } else if (value < 0.875) {
    r = 1;
    g = 1 - (value - 0.625) * 4;
    b = 0;
  } else {
    r = 1 - (value - 0.875) * 2;
    g = 0;
    b = 0;
  }
  return [
    Math.round(Math.max(0, Math.min(1, r)) * 255),
    Math.round(Math.max(0, Math.min(1, g)) * 255),
    Math.round(Math.max(0, Math.min(1, b)) * 255),
  ];
}

/**
 * Generate a 2D Gaussian blob centered at (cx, cy) with given sigma.
 */
function gaussianBlob(width, height, cx, cy, sigma) {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      data[y * width + x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
    }
  }
  return data;
}

/**
 * Analyze the image to detect discolored (non-green) regions,
 * simulating what GradCAM would highlight for disease detection.
 */
function analyzeImageForActivation(imgData, width, height, diseaseKey) {
  const activation = new Float32Array(width * height);

  if (diseaseKey === "healthy") {
    const cx = width * (0.3 + Math.random() * 0.4);
    const cy = height * (0.3 + Math.random() * 0.4);
    const blob = gaussianBlob(width, height, cx, cy, width * 0.5);
    for (let i = 0; i < activation.length; i++) {
      activation[i] = blob[i] * 0.3 + Math.random() * 0.05;
    }
    return activation;
  }

  const pixels = imgData.data;
  const rawScores = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      const greenDominance = g - (r + b) / 2;
      const brownish = (r > g && r > 80 && g > 40 && g < 180) ? (r - g) / 255 : 0;
      const yellowish = (r > 150 && g > 150 && b < 100) ? (r + g - b * 2) / (3 * 255) : 0;
      const darkSpot = (r < 60 && g < 60 && b < 60) ? 0.3 : 0;
      const whiteSpot = (r > 200 && g > 200 && b > 200) ? 0.2 : 0;
      const paleness = Math.max(0, -greenDominance / 128);

      rawScores[y * width + x] = Math.min(1,
        brownish * 1.5 + yellowish * 1.2 + darkSpot + whiteSpot + paleness * 0.8
      );
    }
  }

  const kernelSize = Math.max(5, Math.floor(width / 16));
  const smoothed = boxBlur(rawScores, width, height, kernelSize);

  let maxVal = 0;
  for (let i = 0; i < smoothed.length; i++) {
    if (smoothed[i] > maxVal) maxVal = smoothed[i];
  }

  if (maxVal < 0.05) {
    const numBlobs = 2 + Math.floor(Math.random() * 3);
    for (let n = 0; n < numBlobs; n++) {
      const cx = width * (0.2 + Math.random() * 0.6);
      const cy = height * (0.2 + Math.random() * 0.6);
      const sigma = width * (0.08 + Math.random() * 0.12);
      const blob = gaussianBlob(width, height, cx, cy, sigma);
      const intensity = 0.5 + Math.random() * 0.5;
      for (let i = 0; i < activation.length; i++) {
        activation[i] = Math.min(1, activation[i] + blob[i] * intensity);
      }
    }
    return activation;
  }

  for (let i = 0; i < smoothed.length; i++) {
    activation[i] = smoothed[i] / maxVal;
  }

  for (let i = 0; i < activation.length; i++) {
    activation[i] = Math.pow(activation[i], 1.5);
  }

  return activation;
}

/**
 * Simple box blur for smoothing activation maps.
 */
function boxBlur(data, width, height, radius) {
  const result = new Float32Array(width * height);
  const size = radius * 2 + 1;
  const area = size * size;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            sum += data[ny * width + nx];
            count++;
          }
        }
      }
      result[y * width + x] = sum / count;
    }
  }
  return result;
}

/**
 * Render the GradCAM visualization on the 3 canvases (client-side fallback).
 */
function generateGradCAM(diseaseKey) {
  const SIZE = 224;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const procCtx = gradcamProcess.getContext("2d");
    procCtx.drawImage(img, 0, 0, SIZE, SIZE);
    const imgData = procCtx.getImageData(0, 0, SIZE, SIZE);

    const origCtx = gradcamOriginal.getContext("2d");
    origCtx.drawImage(img, 0, 0, SIZE, SIZE);

    gradcamDemo.style.display = "none";
    gradcamGrid.style.display = "grid";

    const activation = analyzeImageForActivation(imgData, SIZE, SIZE, diseaseKey);

    const heatCtx = gradcamHeatmap.getContext("2d");
    const heatImgData = heatCtx.createImageData(SIZE, SIZE);
    for (let i = 0; i < activation.length; i++) {
      const [r, g, b] = jetColormap(activation[i]);
      heatImgData.data[i * 4] = r;
      heatImgData.data[i * 4 + 1] = g;
      heatImgData.data[i * 4 + 2] = b;
      heatImgData.data[i * 4 + 3] = 255;
    }
    heatCtx.putImageData(heatImgData, 0, 0);

    const overCtx = gradcamOverlay.getContext("2d");
    overCtx.drawImage(img, 0, 0, SIZE, SIZE);
    const overImgData = overCtx.getImageData(0, 0, SIZE, SIZE);
    const alpha = 0.45;
    for (let i = 0; i < activation.length; i++) {
      const [hr, hg, hb] = jetColormap(activation[i]);
      const px = i * 4;
      const blendAlpha = Math.min(1, activation[i] * 1.5) * alpha;
      overImgData.data[px] = Math.round(overImgData.data[px] * (1 - blendAlpha) + hr * blendAlpha);
      overImgData.data[px + 1] = Math.round(overImgData.data[px + 1] * (1 - blendAlpha) + hg * blendAlpha);
      overImgData.data[px + 2] = Math.round(overImgData.data[px + 2] * (1 - blendAlpha) + hb * blendAlpha);
    }
    overCtx.putImageData(overImgData, 0, 0);
  };
  img.src = previewImg.src;
}

// =============================================
// Smooth scroll for anchor links
// =============================================
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

// =============================================
// Initial page load animation
// =============================================
window.addEventListener("load", () => {
  document.body.style.opacity = "1";

  // Render demo GradCAM placeholder: brownspot image + centered heatmap
  const demoImg = new Image();
  demoImg.onload = () => {
    const SIZE = 224;
    const ctx = gradcamDemoCanvas.getContext("2d");
    ctx.drawImage(demoImg, 0, 0, SIZE, SIZE);

    // Get the image data to blend
    const imgData = ctx.getImageData(0, 0, SIZE, SIZE);
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const sigma = SIZE * 0.22;
    const alpha = 0.5;

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const val = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        const [hr, hg, hb] = jetColormap(val);
        const blend = Math.min(1, val * 1.5) * alpha;
        const px = (y * SIZE + x) * 4;
        imgData.data[px] = Math.round(imgData.data[px] * (1 - blend) + hr * blend);
        imgData.data[px + 1] = Math.round(imgData.data[px + 1] * (1 - blend) + hg * blend);
        imgData.data[px + 2] = Math.round(imgData.data[px + 2] * (1 - blend) + hb * blend);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  };
  demoImg.src = "assets/images/brownspot.png";
});
