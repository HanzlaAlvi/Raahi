'use strict';
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // process.env.MONGO_URI use karein, aur backup ke liye hardcoded link rakhein (optional)
    const dbUrl = process.env.MONGO_URI || 'mongodb+srv://Hanzla:Hanzla_123@cluster0.oyyh8sb.mongodb.net/transportdb';

    await mongoose.connect(dbUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected');
  } catch (e) {
    console.error('❌ MongoDB Error:', e);
    process.exit(1);
  }
};

module.exports = connectDB;
