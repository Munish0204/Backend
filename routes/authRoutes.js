import express from 'express';
import { supabase } from '../services/supabaseClient.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email } = req.body;

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ message: 'Login email sent!' });
});

// You’ll handle the token verification on the frontend using Supabase JS Client.
export default router;
