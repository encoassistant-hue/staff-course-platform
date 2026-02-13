require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || null;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || null;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/api/auth/discord/callback`;
const REQUIRED_DISCORD_ROLE_ID = process.env.REQUIRED_DISCORD_ROLE_ID || null;
const ADMIN_DISCORD_ROLE_ID = process.env.ADMIN_DISCORD_ROLE_ID || null;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || null;

// PostgreSQL Connection Pool - with fallback
let pool;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  pool.on('error', (err) => {
    console.error('Database connection error:', err.message);
  });
} else {
  console.warn('⚠️  DATABASE_URL not set - PostgreSQL service may not be connected yet');
  console.warn('    Add PostgreSQL service in Railway dashboard to enable database features');
}

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Initialize database
async function initializeDatabase() {
  // Skip if no pool (DATABASE_URL not set)
  if (!pool) {
    console.log('⏳ Skipping database initialization - waiting for PostgreSQL connection');
    return;
  }
  
  const client = await pool.connect();
  try {
    console.log('Initializing PostgreSQL database...');
    
    // Users table
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
      )
    `);
    
    // Progress table
    await client.query(`
      CREATE TABLE IF NOT EXISTS progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        section_id INTEGER NOT NULL,
        video_id INTEGER NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        watched_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, course_id, video_id)
      )
    `);
    
    // Completions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS completions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, course_id)
      )
    `);
    
    // User settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        theme TEXT DEFAULT 'dark',
        notifications_enabled BOOLEAN DEFAULT TRUE,
        email_notifications BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log('✅ Database tables created successfully');
    
    // Check if default users exist
    const existingUsers = await client.query('SELECT COUNT(*) as count FROM users WHERE username = $1', ['staff1']);
    
    if (existingUsers.rows[0].count === 0) {
      const hashedPassword1 = bcrypt.hashSync('staff123', 10);
      const hashedPassword2 = bcrypt.hashSync('staff456', 10);
      
      await client.query(
        'INSERT INTO users (username, password, name) VALUES ($1, $2, $3)',
        ['staff1', hashedPassword1, 'Staff Member 1']
      );
      await client.query(
        'INSERT INTO users (username, password, name) VALUES ($1, $2, $3)',
        ['staff2', hashedPassword2, 'Staff Member 2']
      );
      console.log('✅ Default users created');
    }
  } catch (err) {
    console.error('Database initialization error:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

// Courses content
const coursesContent = [
  {
    id: 1,
    name: 'AI Course',
    icon: '🤖',
    sections: [
      {
        id: 1,
        title: 'Section 1: Introduction',
        videos: [
          {
            id: 1,
            title: 'What is GenerativeAI',
            url: 'https://stream.mux.com/02rq00anWWJq300gHq8uww025oWs0015cG14x7hGs83qGOjw.m3u8?token=eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIwMnJxMDBhbldXSnEzMDBnSHE4dXd3MDI1b1dzMDAxNWNHMTR4N2hHczgzcUdPanciLCJleHAiOjE3NzMxODcyMDAsImtpZCI6IjJIeEtWQlZSWGRDMDFpNDZ4MDBNR09KMngxaXM4QjAyUlpDRFlCd2taOGp4TUEiLCJhdWQiOiJ2In0.uwjg95xYKsonn1u-5Lc4PdNhZmijAMKvj4KYJFCfjzOYDFXgcv-htHddrQBOxMrEZhxD2D7NJpflEZyUC6sJHLCg7_j5CxSsm7k_TKGiAtLkEtXCNpWJyAeUcmN3tPOQWkINd0kQYeJYjv5fuzGTCz8wN6DRGdT1x47H0zIyNIsNNHgTzT5i9xYKAGSGojp28sNSsZnef_EoJX-Am-Q7_DbpWeXsnYZR95C-8bDomup6kWuHb0IFGv_6U86Oyy01QkpGgGN89Lnoha8tkGxbAWi5PrnlG_N0VifDElC7DfZqrJt0epwi-4SbRBYwKmJWLNKaKLdX5CQMMgAJzTDmiQ'
          }
        ]
      }
    ]
  }
];

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Config
app.get('/api/config', (req, res) => {
  res.json({
    discord_enabled: !!DISCORD_CLIENT_ID,
    debug: {
      client_id: DISCORD_CLIENT_ID ? DISCORD_CLIENT_ID.substring(0, 8) + '...' : 'not set',
      redirect_uri: DISCORD_REDIRECT_URI,
      guild_id: DISCORD_GUILD_ID ? DISCORD_GUILD_ID : 'not set'
    }
  });
});

// Login route
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const passwordMatch = bcrypt.compareSync(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Update last_login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    
    const token = jwt.sign({ id: user.id, username: user.username, name: user.name }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, name: user.name } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Discord OAuth
app.get('/api/auth/discord', (req, res) => {
  if (!DISCORD_CLIENT_ID) {
    return res.status(400).json({ error: 'Discord login not configured' });
  }
  
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email guilds.members.read'
  });
  
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

app.get('/api/auth/discord/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    
    console.log('🔐 Discord callback:', { code: code ? 'present' : 'missing', error });
    
    if (error) {
      console.warn('Discord returned error:', error);
      return res.redirect(`/?error=${error}`);
    }
    if (!code) {
      console.warn('No code provided');
      return res.redirect('/?error=no_code');
    }
    
    // Step 1: Exchange code for access token
    console.log('📝 Exchanging code for access token...');
    let tokenResponse;
    try {
      tokenResponse = await axios.post('https://discord.com/api/oauth2/token', {
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: DISCORD_REDIRECT_URI
      });
      console.log('✅ Got access token');
    } catch (tokenErr) {
      console.error('❌ Token exchange failed:', tokenErr.response?.data || tokenErr.message);
      throw new Error(`Token exchange failed: ${tokenErr.message}`);
    }
    
    const { access_token } = tokenResponse.data;
    
    // Step 2: Get Discord user info
    console.log('👤 Fetching Discord user info...');
    let userResponse;
    try {
      userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      console.log('✅ Got user info:', { id: userResponse.data.id, username: userResponse.data.username });
    } catch (userErr) {
      console.error('❌ User fetch failed:', userErr.response?.data || userErr.message);
      throw new Error(`User fetch failed: ${userErr.message}`);
    }
    
    const discordUser = userResponse.data;
    
    // Step 3: Check guild membership and roles
    console.log('🔍 Checking guild membership...');
    if (DISCORD_GUILD_ID && REQUIRED_DISCORD_ROLE_ID) {
      try {
        const memberResponse = await axios.get(
          `https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`,
          { headers: { Authorization: `Bearer ${access_token}` } }
        );
        
        const userRoles = memberResponse.data.roles || [];
        const hasAdminRole = ADMIN_DISCORD_ROLE_ID && userRoles.includes(ADMIN_DISCORD_ROLE_ID);
        const hasRequiredRole = userRoles.includes(REQUIRED_DISCORD_ROLE_ID);
        
        console.log('📋 Role check:', { userRoles, hasAdminRole, hasRequiredRole });
        
        if (!hasAdminRole && !hasRequiredRole) {
          console.warn(`❌ Access denied for ${discordUser.username} - missing both admin and required roles`);
          return res.redirect('/?error=no_permission');
        }
        console.log('✅ Role check passed');
      } catch (roleErr) {
        console.error('⚠️ Role check failed (continuing anyway):', roleErr.message);
        // Don't block on role check failure - let them in anyway
      }
    }
    
    // Step 4: Database operations (if connected)
    let user = null;
    if (pool) {
      console.log('💾 Checking database...');
      try {
        let result = await pool.query('SELECT * FROM users WHERE discord_id = $1', [discordUser.id]);
        user = result.rows[0];
        
        if (!user) {
          console.log('📝 Creating new user...');
          const insertResult = await pool.query(
            `INSERT INTO users (discord_id, username, name, email, avatar_url)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [
              discordUser.id,
              discordUser.username,
              discordUser.global_name || discordUser.username,
              discordUser.email,
              discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null
            ]
          );
          user = insertResult.rows[0];
          console.log('✅ User created:', { id: user.id, username: user.username });
          
          // Create user settings
          await pool.query('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);
          console.log('✅ User settings created');
        } else {
          console.log('✅ User found, updating last_login...');
          await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
        }
      } catch (dbErr) {
        console.error('❌ Database error:', dbErr.message);
        // If database fails, still create a minimal user object for JWT
        if (!user) {
          user = {
            id: `discord_${discordUser.id}`,
            username: discordUser.username,
            name: discordUser.global_name || discordUser.username
          };
          console.warn('⚠️ Using temporary user object (database unavailable)');
        }
      }
    } else {
      console.warn('⚠️ Database not connected, using temporary user object');
      user = {
        id: `discord_${discordUser.id}`,
        username: discordUser.username,
        name: discordUser.global_name || discordUser.username
      };
    }
    
    // Step 5: Create JWT token
    console.log('🔑 Creating JWT token...');
    const token = jwt.sign({ 
      id: user.id, 
      username: user.username, 
      name: user.name,
      discord_id: discordUser.id
    }, JWT_SECRET);
    console.log('✅ Token created');
    
    console.log('✨ Discord login successful for:', discordUser.username);
    res.redirect(`/?token=${token}`);
    
  } catch (err) {
    console.error('❌ DISCORD AUTH FAILED:', {
      message: err.message,
      stack: err.stack,
      response: err.response?.data
    });
    res.redirect('/?error=discord_error&details=' + encodeURIComponent(err.message));
  }
});

// User profile
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, name, email, avatar_url, discord_id FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get courses
app.get('/api/courses', (req, res) => {
  res.json(coursesContent);
});

// Get progress
app.get('/api/progress/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const result = await pool.query(
      'SELECT * FROM progress WHERE user_id = $1 AND course_id = $2',
      [req.user.id, courseId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching progress:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark video as watched
app.post('/api/progress', authenticateToken, async (req, res) => {
  try {
    const { courseId, sectionId, videoId } = req.body;
    
    const result = await pool.query(
      `INSERT INTO progress (user_id, course_id, section_id, video_id, completed, watched_at)
       VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, course_id, video_id) 
       DO UPDATE SET completed = true, watched_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.id, courseId, sectionId, videoId]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating progress:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check completion
app.get('/api/completion/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM completions WHERE user_id = $1 AND course_id = $2',
      [req.user.id, courseId]
    );
    
    res.json({
      completed: result.rows.length > 0,
      completedAt: result.rows[0]?.completed_at
    });
  } catch (err) {
    console.error('Error checking completion:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark course as completed
app.post('/api/completion', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.body;
    
    const result = await pool.query(
      `INSERT INTO completions (user_id, course_id, completed_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, course_id) DO NOTHING
       RETURNING *`,
      [req.user.id, courseId]
    );
    
    res.json({ success: true, completedAt: result.rows[0]?.completed_at });
  } catch (err) {
    console.error('Error completing course:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
async function start() {
  try {
    // Initialize database but don't crash if it fails
    try {
      await initializeDatabase();
    } catch (dbErr) {
      console.warn('⚠️ Database initialization failed:', dbErr.message);
      console.warn('ℹ️ Ensure DATABASE_URL is set in Railway variables');
    }
    
    // Start server regardless
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📍 https://staff.orthotal.com`);
      if (!process.env.DATABASE_URL) {
        console.warn('⚠️ WARNING: DATABASE_URL not set - database features unavailable');
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
