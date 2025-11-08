const express = require('express');
// CORS is handled by custom middleware below - no need for cors library
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
// CORS configuration - explicitly set Access-Control-Allow-Origin header
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL
].filter(Boolean); // Remove undefined values

// Helper function to check if origin should be allowed
function isOriginAllowed(origin) {
  if (!origin) return false;
  
  // Allow localhost in development
  if (process.env.NODE_ENV !== 'production') {
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return true;
    }
  }
  
  // Check exact match in allowed origins
  if (allowedOrigins.indexOf(origin) !== -1) {
    return true;
  }
  
  // Allow any Vercel domain (for preview deployments)
  if (origin.includes('.vercel.app')) {
    console.log('CORS: Allowing Vercel domain:', origin);
    return true;
  }
  
  // If FRONTEND_URL is not set in production, allow any origin (for testing)
  if (!process.env.FRONTEND_URL && process.env.NODE_ENV === 'production') {
    console.warn('CORS: FRONTEND_URL not set, allowing origin:', origin);
    return true;
  }
  
  return false;
}

// Log allowed origins for debugging
console.log('CORS Configuration:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('Allowed Origins:', allowedOrigins);
console.log('Note: Vercel domains (*.vercel.app) are automatically allowed');

// Custom CORS middleware to explicitly set Access-Control-Allow-Origin header
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Determine which origin to allow
  let allowedOrigin = null;
  
  if (origin) {
    if (isOriginAllowed(origin)) {
      allowedOrigin = origin;
    }
  }
  
  // Explicitly set Access-Control-Allow-Origin header
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    console.log('CORS: Set Access-Control-Allow-Origin to:', allowedOrigin);
  } else if (origin) {
    // If we have an origin but it's not allowed, still allow it in development/testing
    if (process.env.NODE_ENV !== 'production' || !process.env.FRONTEND_URL) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      console.log('CORS: Set Access-Control-Allow-Origin to (permissive):', origin);
    } else {
      // Strict mode: block the origin
      console.error('CORS: Blocked origin:', origin);
      console.error('CORS: Allowed origins:', allowedOrigins);
      return res.status(403).json({ error: 'Not allowed by CORS', origin: origin });
    }
  } else if (allowedOrigins.length > 0) {
    // Fallback to first allowed origin
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    console.log('CORS: Set Access-Control-Allow-Origin to (fallback):', allowedOrigins[0]);
  } else {
    // No origin and no allowed origins: allow all (credentials must be false)
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Note: Cannot set credentials to true with wildcard origin
    console.log('CORS: Set Access-Control-Allow-Origin to: * (no credentials)');
  }
  
  // Set other required CORS headers
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    console.log('CORS: Handling OPTIONS preflight request from:', origin);
    return res.status(200).end();
  }
  
  next();
});

app.use(express.json());
app.use(express.static('uploads'));
app.use('/audio', express.static('audio'));

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const audioDir = path.join(__dirname, 'audio');
const tempDir = path.join(__dirname, 'temp');

[uploadsDir, audioDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Database setup
const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS conversions (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    audio_file TEXT,
    text_length INTEGER
  )`);
});

// Multer configuration for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept PDF files
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      const error = new Error('Only PDF files are allowed!');
      error.status = 400;
      cb(error, false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Helper function to convert text to speech
async function textToSpeech(text, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const gTTS = require('google-tts-api');
      const ffmpeg = require('fluent-ffmpeg');
      const tempDir = path.join(__dirname, 'temp');
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Clean text - remove excessive whitespace and newlines
      const cleanText = text.replace(/\s+/g, ' ').trim();
      
      // Split text into chunks (Google TTS limit is ~200 characters per request)
      const maxLength = 200;
      const textChunks = [];
      
      // Split by sentences first for natural pauses
      const sentences = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
      let currentChunk = '';
      
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= maxLength) {
          currentChunk += sentence + ' ';
        } else {
          if (currentChunk.trim()) {
            textChunks.push(currentChunk.trim());
          }
          // If single sentence is longer than maxLength, split by words
          if (sentence.length > maxLength) {
            const words = sentence.split(' ');
            let wordChunk = '';
            for (const word of words) {
              if ((wordChunk + word).length <= maxLength) {
                wordChunk += word + ' ';
              } else {
                if (wordChunk.trim()) {
                  textChunks.push(wordChunk.trim());
                }
                wordChunk = word + ' ';
              }
            }
            if (wordChunk.trim()) {
              currentChunk = wordChunk;
            } else {
              currentChunk = '';
            }
          } else {
            currentChunk = sentence + ' ';
          }
        }
      }
      if (currentChunk.trim()) {
        textChunks.push(currentChunk.trim());
      }
      
      console.log(`Processing ${textChunks.length} text chunks...`);
      
      // Get audio URLs for all chunks
      const audioUrls = await Promise.all(
        textChunks.map((chunk, index) => {
          return gTTS.getAudioUrl(chunk, {
            lang: 'en',
            slow: false,
            host: 'https://translate.google.com',
          });
        })
      );
      
      // Download all audio files to temporary directory
      const tempFiles = [];
      for (let i = 0; i < audioUrls.length; i++) {
        const tempFile = path.join(tempDir, `chunk_${i}.mp3`);
        await downloadAudio(audioUrls[i], tempFile);
        tempFiles.push(tempFile);
      }
      
      // Combine audio files using ffmpeg
      if (tempFiles.length === 1) {
        // If only one file, just rename it
        fs.renameSync(tempFiles[0], outputPath);
        // Clean up
        tempFiles.forEach(file => {
          if (fs.existsSync(file)) fs.unlinkSync(file);
        });
        resolve(outputPath);
      } else {
        // Combine multiple files
        const concatListFile = path.join(tempDir, 'concat_list.txt');
        const concatList = tempFiles.map(file => `file '${file}'`).join('\n');
        fs.writeFileSync(concatListFile, concatList);
        
        ffmpeg()
          .input(concatListFile)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c', 'copy'])
          .output(outputPath)
          .on('end', () => {
            // Clean up temporary files
            tempFiles.forEach(file => {
              if (fs.existsSync(file)) fs.unlinkSync(file);
            });
            if (fs.existsSync(concatListFile)) fs.unlinkSync(concatListFile);
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error('FFmpeg error:', err);
            // Fallback: try without ffmpeg (may not work perfectly)
            try {
              const buffers = tempFiles.map(file => fs.readFileSync(file));
              const combined = Buffer.concat(buffers);
              fs.writeFileSync(outputPath, combined);
              tempFiles.forEach(file => {
                if (fs.existsSync(file)) fs.unlinkSync(file);
              });
              if (fs.existsSync(concatListFile)) fs.unlinkSync(concatListFile);
              resolve(outputPath);
            } catch (fallbackError) {
              reject(fallbackError);
            }
          })
          .run();
      }
    } catch (error) {
      console.error('TTS Error:', error);
      reject(error);
    }
  });
}

// Helper function to download audio from URL to file
function downloadAudio(url, filePath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? require('https') : require('http');
    const fileStream = fs.createWriteStream(filePath);
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        fileStream.close();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(new Error(`Failed to download audio: ${response.statusCode}`));
        return;
      }
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(filePath);
      });
      fileStream.on('error', (err) => {
        fileStream.close();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(err);
      });
    }).on('error', (err) => {
      fileStream.close();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      reject(err);
    });
  });
}

// Routes
app.post('/api/upload', (req, res, next) => {
  upload.single('pdf')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: 'Unexpected file field. Use "pdf" as the field name.' });
        }
        return res.status(400).json({ error: err.message || 'File upload error' });
      }
      // Handle other errors (like fileFilter errors)
      return res.status(400).json({ error: err.message || 'File upload error' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please select a PDF file.' });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    const fileId = uuidv4();
    const filePath = req.file.path;
    const originalFilename = req.file.originalname;

    console.log(`File uploaded: ${originalFilename} (${req.file.size} bytes)`);

    // Insert into database
    db.run(
      'INSERT INTO conversions (id, filename, original_filename, status) VALUES (?, ?, ?, ?)',
      [fileId, req.file.filename, originalFilename, 'processing'],
      (err) => {
        if (err) {
          console.error('Database error:', err);
        }
      }
    );

    // Process PDF asynchronously
    processPDF(fileId, filePath, originalFilename);

    res.json({
      id: fileId,
      filename: originalFilename,
      status: 'processing',
      message: 'File uploaded successfully. Processing...'
    });
  } catch (error) {
    console.error('Upload processing error:', error);
    next(error); // Pass error to error handling middleware
  }
});

async function processPDF(fileId, filePath, originalFilename) {
  try {
    // Read PDF file
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    
    const text = pdfData.text;
    const textLength = text.length;

    if (!text || text.trim().length === 0) {
      throw new Error('No text content found in PDF');
    }

    // Update database with text length
    db.run(
      'UPDATE conversions SET text_length = ?, status = ? WHERE id = ?',
      [textLength, 'converting', fileId]
    );

    // Convert text to speech
    const audioFileName = `${fileId}.mp3`;
    const audioPath = path.join(audioDir, audioFileName);

    await textToSpeech(text, audioPath);

    // Update database with completion
    db.run(
      'UPDATE conversions SET status = ?, audio_file = ? WHERE id = ?',
      ['completed', audioFileName, fileId]
    );

    console.log(`Conversion completed for ${originalFilename}`);
  } catch (error) {
    console.error('Processing error:', error);
    db.run(
      'UPDATE conversions SET status = ? WHERE id = ?',
      ['failed', fileId]
    );
  }
}

app.get('/api/status/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    'SELECT * FROM conversions WHERE id = ?',
    [id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Conversion not found' });
      }
      res.json(row);
    }
  );
});

app.get('/api/audio/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    'SELECT audio_file FROM conversions WHERE id = ? AND status = ?',
    [id, 'completed'],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!row || !row.audio_file) {
        return res.status(404).json({ error: 'Audio file not found' });
      }

      const audioPath = path.join(audioDir, row.audio_file);
      if (fs.existsSync(audioPath)) {
        res.sendFile(audioPath);
      } else {
        res.status(404).json({ error: 'Audio file not found on disk' });
      }
    }
  );
});

app.get('/api/conversions', (req, res) => {
  db.all(
    'SELECT id, original_filename, status, created_at, text_length FROM conversions ORDER BY created_at DESC LIMIT 20',
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// Error handling middleware (must be after all routes, before listen)
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({ 
    error: error.message || 'An error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// 404 handler (must be after all routes, before listen)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log(`CORS enabled for: ${allowedOrigins.join(', ') || 'All origins (FRONTEND_URL not set)'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use.`);
    console.error(`Please either:`);
    console.error(`  1. Stop the process using port ${PORT}`);
    console.error(`  2. Use a different port by setting PORT environment variable:`);
    console.error(`     PORT=5001 node server.js\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed.');
    db.close((err) => {
      if (err) {
        console.error(err.message);
      }
      console.log('Database connection closed.');
      process.exit(0);
    });
  });
});

