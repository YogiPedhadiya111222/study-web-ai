const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');
const taskRoutes = require('./src/routes/taskRoutes');
const sessionRoutes = require('./src/routes/sessionRoutes');
const recommendationRoutes = require('./src/routes/recommendationRoutes');
const testRoutes = require('./src/routes/testRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const activityRoutes = require('./src/routes/activityRoutes');
const mlRoutes = require('./src/routes/mlRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const errorHandler = require('./src/middlewares/errorMiddleware');

dotenv.config();

connectDB();

const app = express();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Study AI backend is running');
});

app.use('/api/tasks', taskRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
