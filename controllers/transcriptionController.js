import { supabase } from '../services/supabaseClient.js';
import axios from 'axios';

const ASSEMBLY_API = 'https://api.assemblyai.com/v2';

export const transcribeAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    // Upload to AssemblyAI
    const uploadRes = await axios.post(`${ASSEMBLY_API}/upload`, req.file.buffer, {
      headers: {
        Authorization: process.env.ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/octet-stream',
      },
    });

    const uploadUrl = uploadRes.data.upload_url;

    // Start transcription
    const transcriptRes = await axios.post(
      `${ASSEMBLY_API}/transcript`,
      { 
        audio_url: uploadUrl,
        speaker_labels: true
      },
      { headers: { Authorization: process.env.ASSEMBLYAI_API_KEY } }
    );

    const transcriptId = transcriptRes.data.id;

    // Poll for completion
    let transcriptData = null;
    while (true) {
      const pollingRes = await axios.get(`${ASSEMBLY_API}/transcript/${transcriptId}`, {
        headers: { Authorization: process.env.ASSEMBLYAI_API_KEY },
      });

      if (pollingRes.data.status === 'completed') {
        transcriptData = pollingRes.data;
        break;
      } else if (pollingRes.data.status === 'error') {
        return res.status(500).json({ 
          error: 'Transcription failed', 
          details: pollingRes.data.error 
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    // Save to Supabase (without user_id)
    const { data, error } = await supabase
      .from('transcriptions')
      .insert([{
        text: transcriptData.text,
        audio_url: uploadUrl,
        raw_response: transcriptData
      }])
      .select();

    if (error) throw error;

    return res.json({ 
      success: true,
      transcription: transcriptData.text,
      id: data[0].id,
      speakers: transcriptData.utterances
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return res.status(500).json({ 
      error: 'Transcription failed',
      details: error.message 
    });
  }
};
