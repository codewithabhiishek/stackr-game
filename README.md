# 🧱 STACKR — One-Tap Tower Stacking Game

<p align="center">
  <b>A fast-paced, precision-timed 3D isometric tower stacking arcade game with combos, dynamic synth audio, and custom physics.</b>
</p>

---

## 🎮 Gameplay & Features

- 🏗️ **Isometric 3D Stacking**: Dynamic canvas-rendered isometric blocks that slide back and forth along alternating X and Z axes.
- ⚡ **Precision Slicing & Perfect Snaps**: Blocks slice realistically when misaligned. Land within the precision threshold to trigger **PERFECT** placements and recover block width.
- 🔥 **Heat Combo Meter**: Chain consecutive perfect placements to build your multiplier (from *COOKING* up to *GODLIKE*).
- 🔊 **Zero-Asset WebAudio Synth**: 100% procedural oscillator-based sound effects with dynamic chord progressions for combos, slices, and collapses.
- 📱 **Fully Responsive & Touch-Optimized**: Smooth 60+ FPS touch/tap gameplay on mobile devices and keyboard controls on desktop.
- 📊 **Local & High Score Tracking**: Real-time stats including score, best streaks, accuracy rate, and clutch saves.

---

## ⌨️ Controls

| Action | Desktop | Mobile / Touch |
| :--- | :--- | :--- |
| **Drop Block** | `Space` / Click | Tap anywhere |
| **Pause Game** | `P` | Pause button |
| **Restart Game** | `R` | Restart button |
| **Toggle Sound** | `M` | Mute button |

---

## 🛠️ Tech Stack

- **Framework**: React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Rendering Engine**: HTML5 2D Canvas (Custom Isometric Math & Particle Engine)
- **Audio**: Web Audio API (Procedural Synthesizer)
- **Analytics**: @vercel/analytics
- **Bundler**: Vite 6

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm / pnpm / yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/codewithabhiishek/stackr-game.git

# Navigate to project directory
cd stackr-game

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production
```bash
npm run build
```

---

## 📄 License
MIT License. Built with ❤️ by [Abhishek](https://github.com/codewithabhiishek).
