# PDF to Audiobook Converter

A full-stack web application that converts PDF documents into audiobooks using text-to-speech technology. Built with React frontend and Node.js/Express backend.

## Features

- 📄 Upload PDF files (up to 50MB)
- 🎤 Convert PDF text to high-quality audio
- 📱 Responsive, modern UI design
- ⚡ Real-time conversion status updates
- 🎧 Built-in audio player
- 💾 Download converted audio files

## Tech Stack

### Frontend
- React 18
- Axios for API calls
- React Dropzone for file uploads
- Modern CSS with gradients and animations

### Backend
- Node.js & Express
- Multer for file uploads
- pdf-parse for PDF text extraction
- Google TTS API for text-to-speech conversion
- SQLite for database
- FFmpeg for audio file concatenation

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14 or higher)
- **npm** (v6 or higher)
- **FFmpeg** (required for audio processing)

### Installing FFmpeg

#### macOS
```bash
brew install ffmpeg
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

#### Windows
Download from [FFmpeg official website](https://ffmpeg.org/download.html) and add to PATH.

## Installation

1. **Clone the repository**
   ```bash
   cd PDF-audio
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

## Running the Application

### Start the Backend Server

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Start the server:
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

   The backend server will run on `http://localhost:5000`

### Start the Frontend Development Server

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Start the React app:
   ```bash
   npm start
   ```

   The frontend will automatically open in your browser at `http://localhost:3000`

## Usage

1. **Upload a PDF**: Drag and drop a PDF file or click to select one
2. **Convert**: Click the "Convert to Audiobook" button
3. **Wait**: The app will process your PDF (this may take a few moments for large files)
4. **Listen**: Once complete, you can preview the audio using the built-in player
5. **Download**: Click the download button to save the audio file

## Project Structure

```
PDF-audio/
├── backend/
│   ├── server.js          # Express server and API routes
│   ├── package.json       # Backend dependencies
│   ├── uploads/          # Uploaded PDF files (created automatically)
│   ├── audio/            # Generated audio files (created automatically)
│   ├── temp/             # Temporary files during processing (created automatically)
│   └── database.sqlite   # SQLite database (created automatically)
├── frontend/
│   ├── src/
│   │   ├── App.js        # Main React component
│   │   ├── App.css       # Styling
│   │   └── index.js      # React entry point
│   ├── public/
│   └── package.json      # Frontend dependencies
└── README.md
```

## API Endpoints

- `POST /api/upload` - Upload a PDF file
- `GET /api/status/:id` - Get conversion status
- `GET /api/audio/:id` - Download the converted audio file
- `GET /api/conversions` - Get list of recent conversions

## Configuration

### Backend Port
The backend server runs on port 5000 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=3001 npm start
```

### Frontend API URL
If your backend runs on a different URL, update the API base URL in `frontend/src/App.js`:

```javascript
const API_BASE_URL = 'http://your-backend-url:port/api';
```

Or set it as an environment variable:
```bash
REACT_APP_API_URL=http://localhost:5001/api npm start
```

## Troubleshooting

### Port 5000 already in use
If you get an error that port 5000 is already in use:

**Option 1: Auto-fix (Recommended)**
The server will automatically attempt to free the port when you run `npm start`. If that doesn't work, try:


### FFmpeg not found
If you get an error about FFmpeg not being found:
- Make sure FFmpeg is installed and accessible in your PATH
- Verify installation: `ffmpeg -version`

### Audio files not combining properly
- Ensure FFmpeg is properly installed
- The app will fall back to a simpler method if FFmpeg fails, but quality may be affected

### Large PDF files
- Processing large PDFs may take several minutes
- The app supports PDFs up to 50MB
- Very long documents will be split into multiple audio chunks and combined

### CORS errors
- Make sure the backend is running before starting the frontend
- Check that the frontend is configured to proxy requests to the correct backend URL

## Limitations

- Maximum file size: 50MB
- Language: English only (can be modified in server.js)
- Audio format: MP3
- Processing time depends on PDF length and content

## Future Improvements

- Support for multiple languages
- Voice selection options
- Batch processing
- Cloud storage integration
- User authentication
- Progress bar with detailed status
- Audio quality options

## License

This project is open source and available under the MIT License.

## Contributing

Contributions, issues, and feature requests are welcome!

## Support

For support, please open an issue in the repository.

