const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const orderRoutes = require('./routes/orderRoutes');
const logger = require('./utils/logger');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', orderRoutes);

app.use((req, res) => {
  res.status(404).json({
    status: 'ERROR',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled express error', { error: err.message, stack: err.stack });
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    status: 'ERROR',
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;
