const multer = require('multer');

// Store files in memory (for AssemblyAI upload)
const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = upload;
