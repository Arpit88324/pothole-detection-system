<div align="center">

# 🛣️ PotholeDetect
### Real-Time AI Road Hazard & Pothole Detection System

![YOLOv8](https://img.shields.io/badge/Model-YOLOv8-FF6F00?style=for-the-badge&logo=yolo)
![React](https://img.shields.io/badge/Frontend-React_19-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Bundler-Vite_8-646CFF?style=for-the-badge&logo=vite)
![TailwindCSS](https://img.shields.io/badge/Styling-TailwindCSS-06B6D4?style=for-the-badge&logo=tailwindcss)
![Python](https://img.shields.io/badge/Backend-Python_3.10-3776AB?style=for-the-badge&logo=python)
![Geoapify](https://img.shields.io/badge/Maps-Geoapify-f59e0b?style=for-the-badge&logo=openstreetmap)

<p align="center">
  <b>An end-to-end intelligent computer vision platform for identifying, tracking, and mapping road hazards to improve urban infrastructure safety.</b>
</p>

---

</div>

## ✨ Key Features

- 🔍 **AI Road Scanner**: Drag-and-drop image & video detection powered by **YOLOv8** with bounding box reticles, latency measurement, and confidence scoring.
- 🗺️ **Interactive Geoapify Map View**: Real-time road hazard mapping featuring glowing critical/moderate severity pins, live autocomplete location search, and one-click turn-by-turn navigation via Google Maps.
- 🔐 **Complete Auth System**: Glassmorphic **Login**, **Sign Up**, and **Password Reset** views with real-time password strength indicators and interactive form validations.
- 🔔 **Toast Notification Engine**: Floating, animated alert toasts for instant feedback on user actions and system events.
- 📊 **Scan History Log**: Persistent log tracking total hazards found, severity metrics, and analysis speeds.
- 🎨 **Cyber-Asphalt & Neon Amber Palette**: Futuristic dark slate interface with high-contrast glowing amber (`#f59e0b`) and cyber cyan accents.

---

## 🏗️ Tech Stack

### **Frontend (Web Application)**
- **Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS + Custom Cyber-Asphalt CSS System
- **Mapping**: Leaflet.js + Geoapify Dark Matter Retina Map API
- **Icons & Effects**: Material Symbols Outlined, Framer Motion, Specular Reflections, Scroll Velocity

### **Backend & Computer Vision**
- **Deep Learning Model**: YOLOv8 (`y8best.pt`)
- **Frameworks**: PyTorch, Ultralytics, OpenCV
- **API Server**: Python Flask (`server.py`)

---

## 🚀 Quick Start Guide

### 1. Clone the Repository
```bash
git clone https://github.com/PrajwalPachbudhe/PotholeDetect.git
cd PotholeDetect
```

### 2. Run the Web Application (Frontend)
```bash
cd web
npm install
npm run dev
```
Open **`http://localhost:5173/`** in your browser.

### 3. Run the AI Detection Backend (Python)
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start Flask Detection API server
python server.py
```
Backend server runs on **`http://localhost:5000`**.

---

## 📷 Inference via Command Line

Run direct YOLOv8 model inference on images or video feeds:

```bash
# Run on video sample
python predict.py model=y8best.pt source="tested.mp4" show=True

# Run on live webcam feed
python predict.py model=y8best.pt source=0 show=True
```

---

## 🌐 Live Deployment

### Deploy to Render
This project includes a pre-configured `render.yaml` blueprint:
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Select **New +** $\rightarrow$ **Static Site**.
3. Link your repository `PrajwalPachbudhe/PotholeDetect`.
4. Set **Build Command**: `cd web && npm install && npm run build`
5. Set **Publish Directory**: `web/dist`

### Deploy to GitHub Pages
Automatic deployment via GitHub Actions is pre-configured in `.github/workflows/deploy.yml`. Enable Pages under **Repository Settings $\rightarrow$ Pages $\rightarrow$ Source: GitHub Actions**.

---

## 👤 Author & Maintainer

**Aroit Wasnik**
- GitHub: [@ArpitWasnik](https://github.com/Arpit88324)

---

<div align="center">
  <sub>Made with ❤️ for safer roads & smarter cities.</sub>
</div>
