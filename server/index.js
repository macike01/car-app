const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const carRoutes = require('./routes/cars');
const rideRoutes = require('./routes/rides');
const eventRoutes = require('./routes/events');
const clubRoutes = require('./routes/clubs');
const leaderboardRoutes = require('./routes/leaderboards');
const contentRoutes = require('./routes/content');
const gamificationRoutes = require('./routes/gamification');

const { authenticateToken } = require('./middleware/auth');
const { handleSocketConnection } = require('./socket/connection');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/carcrew', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/cars', authenticateToken, carRoutes);
app.use('/api/rides', authenticateToken, rideRoutes);
app.use('/api/events', authenticateToken, eventRoutes);
app.use('/api/clubs', authenticateToken, clubRoutes);
app.use('/api/leaderboards', authenticateToken, leaderboardRoutes);
app.use('/api/content', authenticateToken, contentRoutes);
app.use('/api/gamification', authenticateToken, gamificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'CarCrew API is running' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  handleSocketConnection(socket, io);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`CarCrew server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});