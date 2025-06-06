import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
dotenv.config();

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

export const transcribeAudio = async (filePath) => {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  // Upload audio to AssemblyAI
  const uploadRes = await axios.post('https://api.assemblyai.com/v2/upload', formData, {
    headers: {
      authorization: ASSEMBLYAI_API_KEY,
      ...formData.getHeaders(),
    },
  });

  const uploadUrl = uploadRes.data.upload_url;

  // Request transcription
  const transcriptRes = await axios.post(
    'https://api.assemblyai.com/v2/transcript',
    { audio_url: uploadUrl },
    { headers: { authorization: ASSEMBLYAI_API_KEY } }
  );

  const transcriptId = transcriptRes.data.id;

  // Poll for completion
  let status;
  let text = '';
  while (status !== 'completed') {
    const pollingRes = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { authorization: ASSEMBLYAI_API_KEY },
    });

    status = pollingRes.data.status;
    if (status === 'completed') {
      text = pollingRes.data.text;
    } else if (status === 'error') {
      throw new Error('Transcription failed');
    }
    await new Promise((r) => setTimeout(r, 2000)); // wait 2 seconds
  }

  return text;
};
