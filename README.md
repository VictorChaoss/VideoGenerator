# ⚡ Seedance Studio

A sleek, standalone AI video generation tool powered by **Seedance** (ByteDance) via **OpenRouter**. No server, no install — just open the HTML file in your browser.

![Seedance Studio](https://img.shields.io/badge/OpenRouter-Seedance%201.5%20%2F%202.0-purple?style=for-the-badge)

## 🚀 Getting Started

1. **Clone or download** this repo
2. **Open `index.html`** in any modern browser (Chrome, Firefox, Edge)
3. Enter your **OpenRouter API key** when prompted → [Get one here](https://openrouter.ai/keys)
4. Write a prompt, pick your settings, hit **Generate**

That's it. No npm, no installs, no backend.

## ✨ Features

- 🎬 **Seedance 1.5 & 2.0** model support
- ⚙️ **Settings** — aspect ratio (16:9, 9:16, 1:1, 4:3), resolution (720p / 1080p), duration (5s / 10s)
- 📊 **Live progress bar** — polls OpenRouter every 5s with estimated time remaining
- ▶️ **In-browser video preview** — plays automatically when ready
- ⬇️ **Download MP4** directly from the tool
- 🕑 **Generation history** — last 20 videos saved locally, click to replay
- 🔐 **API key stored locally** — never leaves your browser (localStorage only)

## 💡 How it works

Uses the [OpenRouter Video Generation API](https://openrouter.ai/docs#video-generation):

1. `POST /api/v1/videos` — submits the generation job
2. Polls the returned `status_url` every 5 seconds
3. Displays the video when status = `completed`

## 💰 Cost

Billed through your OpenRouter account on a pay-per-generation basis. Check current pricing on [openrouter.ai](https://openrouter.ai).

## 🛠 Requirements

- A modern browser (Chrome recommended)
- An [OpenRouter API key](https://openrouter.ai/keys) with credits

## 📁 File Structure

```
index.html   ← the entire app (self-contained, no dependencies)
README.md
```

## License

MIT — free to use, modify, and share.
