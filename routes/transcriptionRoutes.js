import express from 'express';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const uploadDir = path.join(__dirname, '../uploads');
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  }
});

const ASSEMBLY_API = 'https://api.assemblyai.com/v2';

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No audio file uploaded' 
      });
    }

    // Get absolute path to the uploaded file
    const filePath = path.resolve(req.file.path);
    const audioFile = fs.createReadStream(filePath);

    // Upload to AssemblyAI
    const uploadResponse = await axios.post(`${ASSEMBLY_API}/upload`, audioFile, {
      headers: {
        authorization: process.env.ASSEMBLYAI_API_KEY,
        'Transfer-Encoding': 'chunked',
      },
    });

    const uploadUrl = uploadResponse.data.upload_url;

    // Start transcription
    const transcriptResponse = await axios.post(
      `${ASSEMBLY_API}/transcript`,
      { 
        audio_url: uploadUrl,
        speaker_labels: true // Enable speaker diarization
      },
      {
        headers: {
          authorization: process.env.ASSEMBLYAI_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    const transcriptId = transcriptResponse.data.id;

    // Poll for completion
    let transcriptData = null;
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 3s = 90s timeout
    
    while (attempts < maxAttempts) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const pollingResponse = await axios.get(
        `${ASSEMBLY_API}/transcript/${transcriptId}`,
        { headers: { authorization: process.env.ASSEMBLYAI_API_KEY } }
      );

      if (pollingResponse.data.status === 'completed') {
        transcriptData = pollingResponse.data;
        break;
      } else if (pollingResponse.data.status === 'error') {
        throw new Error(pollingResponse.data.error || 'Transcription failed');
      }
    }

    if (!transcriptData) {
      throw new Error('Transcription timed out');
    }

    // Clean up - delete the temporary file
    fs.unlinkSync(filePath);

    return res.json({
      success: true,
      transcription: transcriptData.text,
      id: transcriptId,
      speakers: transcriptData.utterances || []
    });

  } catch (error) {
    console.error('Transcription error:', error);

    // Clean up temp file if it exists
    if (req.file?.path) {
      try {
        fs.unlinkSync(path.resolve(req.file.path));
      } catch (err) {
        console.error('Error deleting temp file:', err);
      }
    }

    return res.status(500).json({ 
      success: false,
      error: 'Transcription failed',
      details: error.response?.data?.error || error.message 
    });
  }
});

export default router;