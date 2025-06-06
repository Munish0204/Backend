import express from 'express';
import multer from 'multer';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

const upload = multer({ dest: 'uploads/' });

const API_KEY = process.env.ASSEMBLYAI_API_KEY;
const ASSEMBLY_API = 'https://api.assemblyai.com/v2';

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/transcription/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

    const filePath = path.resolve(req.file.path);
    const audioStream = fs.createReadStream(filePath);

    // Upload audio to AssemblyAI
    const uploadResponse = await axios.post(
      `${ASSEMBLY_API}/upload`,
      audioStream,
      {
        headers: {
          authorization: API_KEY,
          'Transfer-Encoding': 'chunked',
        },
      }
    );

    const uploadUrl = uploadResponse.data.upload_url;

    // Start transcription with explicit language code (English US)
    const transcriptResponse = await axios.post(
      `${ASSEMBLY_API}/transcript`,
      {
        audio_url: uploadUrl,
        language_code: 'en_us',  // force English US
      },
      {
        headers: {
          authorization: API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    const transcriptId = transcriptResponse.data.id;

    // Poll for transcription status
    let transcriptData = null;
    while (true) {
      await new Promise((r) => setTimeout(r, 3000)); // 3 seconds delay

      const pollingRes = await axios.get(`${ASSEMBLY_API}/transcript/${transcriptId}`, {
        headers: { authorization: API_KEY },
      });

      if (pollingRes.data.status === 'completed') {
        transcriptData = pollingRes.data;
        break;
      } else if (pollingRes.data.status === 'error') {
        fs.unlinkSync(filePath);
        return res.status(500).json({ error: 'Transcription failed', details: pollingRes.data.error });
      }
    }

    fs.unlinkSync(filePath);

    console.log('AssemblyAI transcription result:', transcriptData);

    return res.json({
      success: true,
      transcription: transcriptData.text,
      id: transcriptId,
    });
  } catch (error) {
    console.error('Transcription error:', error);
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(path.resolve(req.file.path));
      } catch {}
    }
    return res.status(500).json({ error: 'Transcription failed', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on PORT: ${PORT}`);
});
