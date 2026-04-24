import 'dotenv/config';
import express from 'express';
import { initDB, getItems, getItem, createItem, updateItem, deleteItem, getMessages, wipeLocal } from './db';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, GridFSBucket, ObjectId } from 'mongodb';
import multer from 'multer';

// Storage setup
const MONGODB_FILE_URI = process.env.MONGODB_FILE_URI || process.env.MONGODB_URI;
let fileDbClient: MongoClient | null = null;
let gridFSBucket: GridFSBucket | null = null;

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Error handling for the process
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function startServer() {
  console.log('Starting server...');
  try {
    await initDB();
    console.log('Database initialized');
  } catch (err) {
    console.error('Failed to initialize database:', err);
    // Continue anyway to allow the server to start, or exit if critical
  }

  try {
    if (MONGODB_FILE_URI) {
      fileDbClient = await MongoClient.connect(MONGODB_FILE_URI);
      const db = fileDbClient.db();
      gridFSBucket = new GridFSBucket(db, { bucketName: 'uploads' });
      console.log('File Storage Database initialized');
    } else {
      console.log('No MONGODB_FILE_URI or MONGODB_URI found for file storage. Uploads will be disabled.');
    }
  } catch (err) {
    console.error('Failed to initialize File Storage database:', err);
  }
  
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  // Middleware to check admin token
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.headers.authorization;
    if (token === 'Bearer admin-token') {
      next();
    } else {
      res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  };

  // AI API Route (Backend API)
  app.post('/api/ai/ask', async (req, res) => {
    try {
      const { prompt, images } = req.body;
      const { GoogleGenAI } = await import('@google/genai');
      
      const apiKey = process.env.VITE_CUSTOM_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ success: false, text: "AI Assistant is missing API key configuration." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const parts: any[] = [{ text: prompt }];
      
      if (images && images.length > 0) {
        images.forEach((img: any) => {
          if (img.inlineData) parts.push(img);
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [{ parts }],
        config: {
          systemInstruction: `You are a precision-oriented academic tutor. Your primary goal is to be helpful, concise, and direct.
          
          CORRESPONDENCE RULES:
          1. CONCISENESS: For greetings (e.g., "Hi", "Bataio sab badiya?") or simple chat, respond naturally and briefly. Do NOT give long introductions or lists of your expertise.
          2. NO REUSE: Do not repeat your persona summary, available domains, or "dynamic equilibrium" metaphors in every turn. Only answer what is asked.
          3. STEM PRECISION: When explaining STEM (Math/Physics/Chemistry), use LaTeX ($...$ or $$...$$).
          4. STRUCTURE: Use tables and code blocks ONLY when data or code is actually requested. Do not force them into conversational replies.
          5. FORMATTING: Use bolding and markdown for clarity, but keep the overall message density high and vertical space low.
          6. TONE: Professional, supportive, but extremely precise. Avoid fluff.`,
          temperature: 0.7,
        }
      });

      res.json({ success: true, text: response.text || "I'm sorry, I couldn't generate an answer at this time." });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ success: false, text: "Oops! Something went wrong while processing your request." });
    }
  });

  // Upload File Route
  app.post('/api/upload-file', upload.single('file'), async (req, res) => {
    if (!gridFSBucket) {
      return res.status(500).json({ success: false, message: 'File storage is not initialized' });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    try {
      const uploadStream = gridFSBucket.openUploadStream(req.file.originalname, {
        metadata: {
          contentType: req.file.mimetype,
          size: req.file.size
        }
      });
      
      uploadStream.end(req.file.buffer);
      
      uploadStream.on('finish', () => {
        res.json({ success: true, url: `/api/files/${uploadStream.id}` });
      });

      uploadStream.on('error', (err) => {
        console.error('Error streaming file to GridFS:', err);
        res.status(500).json({ success: false, message: 'Failed to upload file' });
      });
    } catch (err) {
      console.error('Upload Error:', err);
      res.status(500).json({ success: false, message: 'Failed to upload file' });
    }
  });

  // Get File Route
  app.get('/api/files/:id', async (req, res) => {
    if (!gridFSBucket) {
      return res.status(500).json({ success: false, message: 'File storage is not initialized' });
    }

    try {
      const id = new ObjectId(req.params.id);
      
      const files = await gridFSBucket.find({ _id: id }).toArray();
      if (!files || files.length === 0) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }

      const file = files[0];
      if (file.metadata?.contentType) res.set('Content-Type', file.metadata.contentType);
      else if ((file as any).contentType) res.set('Content-Type', (file as any).contentType); // Legacy fallback
      
      // Setup cache headers (1 year for immutable images)
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      
      const downloadStream = gridFSBucket.openDownloadStream(id);
      downloadStream.pipe(res);
      
      downloadStream.on('error', (err) => {
        console.error('Error streaming file from GridFS:', err);
        res.status(404).json({ success: false, message: 'Error retrieving file' });
      });
    } catch (err) {
      console.error('File Read Error:', err);
      res.status(500).json({ success: false, message: 'Failed to read file' });
    }
  });

  // Storage Stats Route
  app.get('/api/storage/stats', async (req, res) => {
    try {
      // Main DB stats
      const mainDbStatus = process.env.MONGODB_URI ? 'Connected' : 'Local Fallback';
      
      // File DB stats
      let fileDbStatus = 'Unconfigured';
      let fileDbStats = { fsUsed: 0, fileCount: 0 };
      
      if (fileDbClient && gridFSBucket) {
        fileDbStatus = 'Connected';
        const db = fileDbClient.db();
        
        try {
          const filesInfo = await gridFSBucket.find({}).toArray();
          fileDbStats.fileCount = filesInfo.length;
          fileDbStats.fsUsed = filesInfo.reduce((acc, file) => acc + file.length, 0);
        } catch (e) {
          console.error('Could not compute file stats:', e);
        }
      }

      res.json({
        success: true,
        mainDb: {
          status: mainDbStatus,
          uri: (process.env.MONGODB_URI || '').split('@').pop() // safe to display host
        },
        fileDb: {
          status: fileDbStatus,
          uri: (process.env.MONGODB_FILE_URI || '').split('@').pop(),
          count: fileDbStats.fileCount,
          size: fileDbStats.fsUsed
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Could not fetch stats' });
    }
  });

  // Generic Get Route
  app.get('/api/:type', async (req, res) => {
    const type = req.params.type as string;
    if (!['batches', 'routines', 'downloads', 'fees', 'enrollments', 'chatUsers', 'chatSettings', 'radars', 'teasers', 'drops', 'stars'].includes(type)) {
      return res.status(404).json([]);
    }
    const items = await getItems(type);
    res.json(items);
  });

  // Generic Post Route
  app.post('/api/:type', async (req, res) => {
    const type = req.params.type as string;
    if (!['batches', 'routines', 'downloads', 'fees', 'enrollments', 'chatUsers', 'chatSettings', 'radars', 'teasers', 'drops', 'stars'].includes(type)) {
      return res.status(404).json({ success: false });
    }
    
    // Allow public POST for enrollments, but require admin for others
    if (type !== 'enrollments') {
      const token = req.headers.authorization;
      if (token !== 'Bearer admin-token') {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
    }

    try {
      const id = await createItem(type, req.body);
      res.json({ success: true, id });
    } catch (err: any) {
      if (err.message === 'STORAGE_FULL') {
        res.status(507).json({ success: false, message: 'MongoDB Storage is Full. Please delete some items.' });
      } else {
        res.status(500).json({ success: false, message: 'Server Error' });
      }
    }
  });

  // User Payment Submission Route
  app.post('/api/enrollments/:id/payment', async (req, res) => {
    const id = req.params.id as string;
    const { paymentRecord } = req.body;
    
    try {
      const enrollments = await getItems('enrollments');
      const enrollment = enrollments.find((e: any) => e.id === id);
      if (!enrollment) {
        return res.status(404).json({ success: false, message: 'Enrollment not found' });
      }

      const updatedEnrollment = {
        ...enrollment,
        paymentHistory: [...(enrollment.paymentHistory || []), paymentRecord]
      };

      await updateItem('enrollments', id, updatedEnrollment);
      res.json({ success: true });
    } catch (err: any) {
      if (err.message === 'STORAGE_FULL') {
        res.status(507).json({ success: false, message: 'Storage is Full.' });
      } else {
        res.status(500).json({ success: false, message: 'Server Error' });
      }
    }
  });

  // Generic Put Route
  app.put('/api/:type/:id', requireAdmin, async (req, res) => {
    const type = req.params.type as string;
    const id = req.params.id as string;
    if (!['batches', 'routines', 'downloads', 'fees', 'enrollments', 'chatUsers', 'chatSettings', 'radars', 'teasers', 'drops', 'stars'].includes(type)) {
      return res.status(404).json({ success: false });
    }
    try {
      await updateItem(type, id, req.body);
      res.json({ success: true });
    } catch (err: any) {
      if (err.message === 'STORAGE_FULL') {
        res.status(507).json({ success: false, message: 'MongoDB Storage is Full. Please delete some items.' });
      } else {
        res.status(500).json({ success: false, message: 'Server Error' });
      }
    }
  });

  // Generic Delete Route
  app.delete('/api/:type/:id', requireAdmin, async (req, res) => {
    const type = req.params.type as string;
    const id = req.params.id as string;
    if (!['batches', 'routines', 'downloads', 'fees', 'enrollments', 'chatUsers', 'chatSettings', 'radars', 'teasers', 'drops', 'stars'].includes(type)) {
      return res.status(404).json({ success: false });
    }
    await deleteItem(type, id);
    res.json({ success: true });
  });

  // Chat APIs
  app.post('/api/chat/register', async (req, res) => {
    const { name, phone } = req.body;
    const id = await createItem('chatUsers', { name, phone, photoUrl: '', bio: '', role: 'student', status: 'active', warnings: 0 });
    const users = await getItems('chatUsers');
    res.json(users.find((u: any) => u.id === id));
  });

  app.put('/api/chat/profile/:id', async (req, res) => {
    await updateItem('chatUsers', req.params.id as string, req.body);
    res.json({ success: true });
  });

  app.get('/api/chat/messages', async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = parseInt(req.query.skip as string) || 0;
    const msgs = await getMessages(limit, skip);
    const users = await getItems('chatUsers');
    
    const populated = msgs.map((m: any) => ({
      ...m,
      user: users.find((u: any) => u.id === m.senderId) || { name: 'Unknown', photoUrl: '', role: 'student' }
    }));
    res.json(populated);
  });

  app.post('/api/maintenance/wipe-local', requireAdmin, async (req, res) => {
    await wipeLocal();
    res.json({ success: true });
  });

  // Serve local_db.json for restoration if it exists
  app.get('/local_db.json', (req, res) => {
    const localDbPath = path.join(__dirname, 'local_db.json');
    if (fs.existsSync(localDbPath)) {
      res.sendFile(localDbPath);
    } else {
      res.status(404).json({ error: 'local_db.json not found' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    console.log('Running in development mode with Vite middleware');
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.error('Failed to start Vite server:', err);
    }
  } else {
    console.log('Running in production mode');
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      // Catch-all route for SPA
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('Warning: dist directory not found. Static files will not be served.');
      app.get('*', (req, res) => {
        res.status(404).send('Production build (dist/) not found. Please run npm run build.');
      });
    }
  }

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    socket.on('join', () => {
      socket.join('study-hub');
    });
    
    socket.on('send_message', async (data) => {
      const user = await getItem('chatUsers', data.senderId);
      if (!user || user.status !== 'active') return;
      
      const msgId = await createItem('chatMessages', {
        senderId: data.senderId,
        text: data.text,
        timestamp: Date.now(),
        isDeleted: false,
        isEdited: false,
        replyTo: data.replyTo || null
      });
      
      const newMsg = { id: msgId, senderId: data.senderId, text: data.text, timestamp: Date.now(), isDeleted: false, isEdited: false, replyTo: data.replyTo || null, user };
      io.to('study-hub').emit('new_message', newMsg);
    });
    
    socket.on('delete_message', async ({ msgId, userId }) => {
      const user = await getItem('chatUsers', userId);
      const msg = await getItem('chatMessages', msgId);
      if (user && msg) {
        const sender = await getItem('chatUsers', msg.senderId);
        const isSenderAdmin = sender?.role === 'admin';
        
        let canDelete = false;
        if (msg.senderId === userId) canDelete = true;
        else if (user.role === 'admin') canDelete = true;
        else if (user.role === 'moderator' && !isSenderAdmin) canDelete = true;
        
        if (canDelete) {
          await updateItem('chatMessages', msgId, { isDeleted: true });
          io.to('study-hub').emit('message_deleted', msgId);
        }
      }
    });

    socket.on('edit_message', async ({ msgId, newText, userId }) => {
      const msg = await getItem('chatMessages', msgId);
      if (msg && msg.senderId === userId && !msg.isDeleted) {
        await updateItem('chatMessages', msgId, { text: newText, isEdited: true });
        io.to('study-hub').emit('message_edited', { msgId, newText });
      }
    });

    socket.on('mute_user', async ({ targetUserId, adminId }) => {
      const admin = await getItem('chatUsers', adminId);
      const targetUser = await getItem('chatUsers', targetUserId);
      
      if (admin && targetUser) {
        let canMute = false;
        if (admin.role === 'admin') canMute = true;
        else if (admin.role === 'moderator' && targetUser.role !== 'admin') canMute = true;
        
        if (canMute) {
          await updateItem('chatUsers', targetUserId, { status: 'muted' });
          io.to('study-hub').emit('user_muted', targetUserId);
        }
      }
    });

    socket.on('update_chat_settings', async ({ name, description, adminId }) => {
      const admin = await getItem('chatUsers', adminId);
      if (admin && admin.role === 'admin') {
        const settings = await getItems('chatSettings');
        let mainSetting = settings.find((s: any) => s.roomId === 'main');
        if (!mainSetting) {
          const newId = await createItem('chatSettings', { roomId: 'main', name, description });
          mainSetting = { id: newId, roomId: 'main', name, description };
        } else {
          await updateItem('chatSettings', mainSetting.id, { name, description });
        }
        io.to('study-hub').emit('chat_settings_updated', { name, description });
      }
    });

    socket.on('profile_updated', (user) => {
      io.to('study-hub').emit('user_profile_updated', user);
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
