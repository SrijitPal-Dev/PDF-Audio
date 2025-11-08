# Quick Start Guide

## Prerequisites

1. Install Node.js (v14+)
2. Install FFmpeg:
   ```bash
   # macOS
   brew install ffmpeg
   
   # Linux
   sudo apt-get install ffmpeg
   
   # Windows - Download from https://ffmpeg.org
   ```

## Installation & Running

### Option 1: Using Startup Scripts (Recommended)

**Terminal 1 - Backend:**
```bash
./start-backend.sh
```

**Terminal 2 - Frontend:**
```bash
./start-frontend.sh
```

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm start
```

## Usage

1. Open http://localhost:3000 in your browser
2. Drag and drop a PDF file or click to select
3. Click "Convert to Audiobook"
4. Wait for processing (may take a few minutes for large files)
5. Listen to the audio or download it

## Troubleshooting

- **FFmpeg not found**: Make sure FFmpeg is installed and in your PATH
- **Port already in use**: Change the port in backend/server.js or set PORT environment variable
- **CORS errors**: Ensure backend is running before starting frontend

## Notes

- Processing time depends on PDF size and length
- Maximum file size: 50MB
- Audio format: MP3
- Language: English (can be changed in backend/server.js)

