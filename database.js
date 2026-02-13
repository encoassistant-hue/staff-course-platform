require('dotenv').config();
const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Initialize database tables
async function initializeDatabase() {
  try {
    const client = await pool.connect();
    
    console.log('Initializing PostgreSQL database...');
    
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        name TEXT NOT NULL,
        email TEXT,
        discord_id TEXT UNIQUE,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        section_id INTEGER NOT NULL,
        video_id INTEGER NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        watched_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, course_id, video_id)
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS completions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, course_id)
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        theme TEXT DEFAULT 'dark',
        notifications_enabled BOOLEAN DEFAULT TRUE,
        email_notifications BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
    
    console.log('Database tables created successfully');
    
    // Check if default users exist
    const existingUsers = await client.query('SELECT COUNT(*) FROM users WHERE username = $1', ['staff1']);
    
    if (existingUsers.rows[0].count === '0') {
      const bcrypt = require('bcryptjs');
      const hashedPassword1 = bcrypt.hashSync('staff123', 10);
      const hashedPassword2 = bcrypt.hashSync('staff456', 10);
      
      await client.query(
        'INSERT INTO users (username, password, name) VALUES ($1, $2, $3)',
        ['staff1', hashedPassword1, 'Staff Member 1']
      );
      console.log('Default user staff1 created');
      
      await client.query(
        'INSERT INTO users (username, password, name) VALUES ($1, $2, $3)',
        ['staff2', hashedPassword2, 'Staff Member 2']
      );
      console.log('Default user staff2 created');
    }
    
    client.release();
    console.log('Database initialization complete');
  } catch (err) {
    console.error('Database initialization error:', err);
    process.exit(1);
  }
}

// Database helper functions
const db = {
  async get(query, values = []) {
    try {
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  
  async all(query, values = []) {
    try {
      const result = await pool.query(query, values);
      return result.rows;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  
  async run(query, values = []) {
    try {
      const result = await pool.query(query, values);
      return result;
    } catch (err) {
      console.error('Database query error:', err);
      throw err;
    }
  },
  
  getPool() {
    return pool;
  }
};

module.exports = {
  db,
  initializeDatabase,
  pool
};
