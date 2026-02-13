require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const qs = require('qs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || null;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || null;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/api/auth/discord/callback`;
const REQUIRED_DISCORD_ROLE_ID = process.env.REQUIRED_DISCORD_ROLE_ID || null;
const ADMIN_DISCORD_ROLE_ID = process.env.ADMIN_DISCORD_ROLE_ID || null;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || null;

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Initialize database
async function initializeDatabase() {
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
          },
          {
            id: 2,
            title: 'History & future of GenAI',
            url: 'https://stream.mux.com/uLedssbt3RhiTTtd9gi5KGs8PBnc7w00Hz6Dz56vcKak.m3u8?token=eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1TGVkc3NidDNSaGlUVHRkOWdpNUtHczhQQm5jN3cwMEh6NkR6NTZ2Y0thayIsImV4cCI6MTc3MzE4NzIwMCwia2lkIjoiMkh4S1ZCVlJYZEMwMWk0NngwME1HT0oyeDFpczhCMDJSWkNEWUJ3a1o4anhNQSIsImF1ZCI6InYifQ.K3Ov4i4wF6bihIVE9EhFhjdDGxmc2ygUF1N4yjAlyHfETjlY1a7xwj9AqnHjggrpG3v8tdZ-gIz6gtJQheKU0W6NrAdTQfeacGEgDkgTc5Qg65rAkTm22g0wqNr8ibid27U4aRBfVEEG9DwcGfkA07k8jdFxb3HX2wzcuS9R6yMi2usQWIa43pMHD_iGKn6YAypHH1asZt9z15mG9HyPBDAp9BwsvH0oM-8Tl06u4EEFqf_v4OMStdjcouAuVhwq7KEivtE4JJrcADNLdpt6UyeiFBxCJeuPvWSpiqx00tg-V6s2xwkvIP2_smqq6shXUS8oxoQQR4qM59veXGvQGg'
          },
          {
            id: 5,
            title: 'GenAI Tech Stack',
            url: 'https://stream.mux.com/uEZxWnkqmkKEOHhO3taf00BBwyduqLn4ypZz11J9kma4.m3u8?token=eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1RVp4V25rcW1rS0VPSGhPM3RhZjAwQkJ3eWR1cUxuNHlwWnoxMUo5a21hNCIsImV4cCI6MTc3MzE4NzIwMCwia2lkIjoiMkh4S1ZCVlJYZEMwMWk0NngwME1HT0oyeDFpczhCMDJSWkNEWUJ3a1o4anhNQSIsImF1ZCI6InYifQ.Ov7yRqrF5TYMX-Rnv3_Obv7b61WKkawoF_Ihac6Dzb7lcwFttvMlKYLwYL9EVkVT8YwJDRZV_xc1NH6vKKrtoqeNDBIj9WPzXPO8hMTTI5lr8qE3YBieSgvxCQx7ad-nCEbePRmbwzAP8bRHg-GX2qJBnLxRIyf7ppLOXKufn6egQ-o1OGpUOTbguxoQi3djd5NlQmgfZ3v5bAu3vRmMYzrGRttRvgsIJqU3pVrpWvo4gcea3yvYvuZ1B_D05m_E-D09GdXOmbFSEQfXOMJUeWJDA3LbXp8p1wTXXFn5DCnVOWFPhzdZjtabOSoarZlqwibLfsJRbvHwCm6lcv_G2w'
          }
        ]
      },
      {
        id: 2,
        title: 'Section 2: Video Ads',
        videos: [
          {
            id: 3,
            title: 'AI UGC Ad Made From Scratch',
            url: 'https://stream.mux.com/vcTRBHhVLze7GtA9kfn9OyK2ljpNWV8N2dqCllioUMY.m3u8?token=eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ2Y1RSQkhoVkx6ZTdHdEE5a2ZuOU95SzJsanBOV1Y4TjJkcUNsbGlvVU1ZIiwiZXhwIjoxNzczMTg3MjAwLCJraWQiOiIySHhLVkJWUlhkQzAxaTQ2eDAwTUdPSjJ4MWlzOEIwMlJaQ0RZQndrWjhqeE1BIiwiYXVkIjoidiJ9.uMk3xnlUgrHW8x7eUSY8oM7QBstP4u5Uly2ImpNE5W1s_6eIT1l_Ha8mXoq_NUCxmEh-gK6RBajNDrIOWUZNlwndS7GWBKK-aQBCmKKiz5MESCzol-OCVW9QYsv-SpgFoEFeSFCiIFprEsmdVt-fhmZQffDFuXrSXbEro9BtRD1u9Wh66I31SNqDHt4NGIU6FDEPU-u14Gxk58H_PfMj8a32gBwChHFHeR14fcX8rgjNICMIJqbkomZhaXlNE-6L4volrswnz2Ya8iUPntnUFo-oR3-5F3zHj-xbnow__NNU0DGO-O5MI5muk5PKVKBS2Hy9BRKl6BrWQoOK4pxGjg'
          },
          {
            id: 4,
            title: 'AI Animation Ad Made From Scratch',
            url: 'https://stream.mux.com/d6wPSb11svUVlBFlLokh5011yq018aDe00nMDlMEJrnw3w.m3u8?token=eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJkNndQU2IxMXN2VVZsQkZsTG9raDUwMTF5cTAxOGFEZTAwbk1EbE1FSnJudzN3IiwiZXhwIjoxNzczMTg3MjAwLCJraWQiOiIySHhLVkJWUlhkQzAxaTQ2eDAwTUdPSjJ4MWlzOEIwMlJaQ0RZQndrWjhqeE1BIiwiYXVkIjoidiJ9.A5ElEGV2o827H5lcYYgq7nmvvxoIFkMMfEO4fgia6jo9CWRqOIolZlfkPrFM23GtmmlqgjrAHJKq1QHc_F49Vx-WPPG4Di_sHmavskwM_jAPQUzetzhIJo-_22EgbwqoMosBWD_jzwCMfVStc0gFbM5MgAIcrs-rM56PqufWwxyxAo9CUSW0GnjfkWl63mqoiPjzFQIs31eho6360n-X1NAubrvKTUod-fyv5E2-gKAS2kPUt4KyfHx6U-RcWxNhzL-nlB_MHGYCutLk4-m2Km1fHMjhU1_cVxusvSNEnDc97sW2lI5TinF73g06FO2xBIKFo4lzFTeqv0Q66Nq1lA',
            resources: [
              {
                title: 'Zack D Films - Visual Prompt Engineer',
                url: 'https://chatgpt.com/g/g-68db88718fb481919f26dd85b2ba6852-zackdfilms-visual-prompt-engineer'
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 2,
    name: 'AI Static Ads',
    icon: '📸',
    sections: [
      {
        id: 3,
        title: 'Section 1: Product Images',
        videos: [
          {
            id: 6,
            title: 'How To Generate 4K Product Images',
            url: 'https://stream.mux.com/HMLqxxvqSX7iiT3UxyOfzANdWT02TWnA00fK2sjziMPUg.m3u8'
          },
          {
            id: 7,
            title: 'How To Generate Organic Product Images',
            url: 'https://stream.mux.com/PURHJG502d8nQ01IBY41NHeE7hHnJz6mDQnT01nKGc63As.m3u8',
            resources: [
              {
                title: 'Product Image Prompt Generator',
                url: 'https://gemini.google.com/gem/1ncygw_3KkmMNMJTbfUQWZ4V-gXVK_2L-?usp=sharing'
              }
            ]
          }
        ]
      },
      {
        id: 4,
        title: 'Section 2: AI Humans',
        videos: [
          {
            id: 8,
            title: 'How To Generate Ultra-Realistic AI Humans',
            url: 'https://stream.mux.com/jIxL5IaqPBzlAqNdxvwBv9pSVRvjwsZMkAMSlN900ngo.m3u8',
            resources: [
              {
                title: 'Portrait Generator',
                url: 'https://gemini.google.com/gem/15sst5Iy4Gc0ka3UTzAUopdwQXB22EF4r?usp=sharing'
              }
            ]
          },
          {
            id: 9,
            title: 'How To Make AI Human Do Whatever You Want',
            url: 'https://stream.mux.com/lhhx569NykSowP00FQdlLbjQdSIZU4lNsi4J4E01301zeA.m3u8',
            resources: [
              {
                title: 'Scene Builder',
                url: 'https://gemini.google.com/gem/1hXD9KITk3HrssaqB126k1972kLJwTOXo?usp=sharing'
              }
            ]
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
    
    console.log('📝 [Discord OAuth] Callback received');
    
    if (error) {
      console.warn(`⚠️ [Discord OAuth] Error in callback: ${error}`);
      return res.redirect(`/?error=${error}`);
    }
    if (!code) {
      console.warn('⚠️ [Discord OAuth] No authorization code received');
      return res.redirect('/?error=no_code');
    }
    
    console.log('📝 [Discord OAuth] Exchanging code for access token...');
    console.log(`📝 [Discord OAuth] Client ID: ${DISCORD_CLIENT_ID}`);
    console.log(`📝 [Discord OAuth] Redirect URI: ${DISCORD_REDIRECT_URI}`);
    console.log(`📝 [Discord OAuth] Grant type: authorization_code`);
    // Exchange code for access token
    let tokenResponse;
    try {
      // Discord OAuth requires form-encoded data, not JSON
      tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
        qs.stringify({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: DISCORD_REDIRECT_URI
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      console.log('✅ [Discord OAuth] Token exchange successful');
    } catch (tokenErr) {
      console.error('❌ [Discord OAuth] Token exchange failed');
      console.error('Discord API response status:', tokenErr.response?.status);
      console.error('Discord API response data:', tokenErr.response?.data);
      console.error('Error message:', tokenErr.message);
      return res.redirect(`/?error=token_exchange_failed&details=${encodeURIComponent(tokenErr.response?.data?.error || tokenErr.message)}`);
    }
    
    const { access_token } = tokenResponse.data;
    
    console.log('📝 [Discord OAuth] Fetching Discord user info...');
    // Get Discord user
    let userResponse;
    try {
      userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      console.log(`✅ [Discord OAuth] User fetched: ${userResponse.data.username}`);
    } catch (userErr) {
      console.error('❌ [Discord OAuth] Failed to fetch user:', userErr.response?.data || userErr.message);
      return res.redirect(`/?error=fetch_user_failed&details=${encodeURIComponent(userErr.response?.data?.message || userErr.message)}`);
    }
    
    const discordUser = userResponse.data;
    console.log(`📝 [Discord OAuth] Discord ID: ${discordUser.id}`);
    
    // Check guild membership (non-blocking)
    if (DISCORD_GUILD_ID && REQUIRED_DISCORD_ROLE_ID) {
      console.log('📝 [Discord OAuth] Checking guild membership and roles...');
      try {
        const memberResponse = await axios.get(
          `https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`,
          { headers: { Authorization: `Bearer ${access_token}` } }
        );
        
        const userRoles = memberResponse.data.roles || [];
        const hasRequiredRole = userRoles.includes(REQUIRED_DISCORD_ROLE_ID);
        const hasAdminRole = userRoles.includes(ADMIN_DISCORD_ROLE_ID);
        
        console.log(`📝 [Discord OAuth] User roles: ${userRoles.join(', ')}`);
        console.log(`📝 [Discord OAuth] Has required role: ${hasRequiredRole}, Has admin role: ${hasAdminRole}`);
        
        if (!hasRequiredRole && !hasAdminRole) {
          console.warn('⚠️ [Discord OAuth] User lacks required or admin role');
          return res.redirect('/?error=no_permission');
        }
        console.log('✅ [Discord OAuth] Role check passed');
      } catch (roleErr) {
        console.warn(`⚠️ [Discord OAuth] Could not check guild membership (non-blocking): ${roleErr.message}`);
        // Non-blocking: allow continuation without role validation
      }
    }
    
    // Find or create user (make DB optional)
    console.log('📝 [Discord OAuth] Checking database for existing user...');
    let user = null;
    
    try {
      let result = await pool.query('SELECT * FROM users WHERE discord_id = $1', [discordUser.id]);
      user = result.rows[0];
      
      if (user) {
        console.log(`✅ [Discord OAuth] Existing user found: ID ${user.id}`);
        // Update last_login
        try {
          await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
          console.log('✅ [Discord OAuth] Updated last_login timestamp');
        } catch (updateErr) {
          console.warn(`⚠️ [Discord OAuth] Failed to update last_login: ${updateErr.message}`);
        }
      } else {
        console.log('📝 [Discord OAuth] New user, inserting into database...');
        const insertResult = await pool.query(
          `INSERT INTO users (discord_id, username, name, email, avatar_url)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [
            discordUser.id,
            discordUser.username,
            discordUser.global_name || discordUser.username,
            discordUser.email,
            `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          ]
        );
        user = insertResult.rows[0];
        console.log(`✅ [Discord OAuth] New user created: ID ${user.id}`);
        
        // Create user settings
        try {
          await pool.query('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);
          console.log('✅ [Discord OAuth] User settings initialized');
        } catch (settingsErr) {
          console.warn(`⚠️ [Discord OAuth] Failed to create user settings: ${settingsErr.message}`);
        }
      }
    } catch (dbErr) {
      console.warn(`⚠️ [Discord OAuth] Database error (using temporary user): ${dbErr.message}`);
      // Fallback: create temporary user object without database
      user = {
        id: null,
        discord_id: discordUser.id,
        username: discordUser.username,
        name: discordUser.global_name || discordUser.username,
        email: discordUser.email
      };
      console.log('✅ [Discord OAuth] Using temporary user object (database offline)');
    }
    
    // Generate JWT token
    console.log('📝 [Discord OAuth] Generating JWT token...');
    const token = jwt.sign({ id: user.id, username: user.username, name: user.name }, JWT_SECRET);
    console.log('✅ [Discord OAuth] Token generated, redirecting to dashboard');
    
    res.redirect(`/?token=${token}`);
  } catch (err) {
    console.error('❌ [Discord OAuth] Unexpected error:', err.message);
    console.error('Stack trace:', err.stack);
    res.redirect(`/?error=discord_error&details=${encodeURIComponent(err.message)}`);
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

// Get user settings
app.get('/api/user/settings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT theme, notifications_enabled, email_notifications FROM user_settings WHERE user_id = $1',
      [req.user.id]
    );
    const settings = result.rows[0] || { theme: 'light', notifications_enabled: true, email_notifications: false };
    res.json(settings);
  } catch (err) {
    console.error('Error fetching user settings:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save user settings
app.post('/api/user/settings', authenticateToken, async (req, res) => {
  try {
    const { theme, notifications_enabled, email_notifications } = req.body;
    
    const result = await pool.query(
      `UPDATE user_settings 
       SET theme = COALESCE($1, theme), 
           notifications_enabled = COALESCE($2, notifications_enabled),
           email_notifications = COALESCE($3, email_notifications),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4
       RETURNING *`,
      [theme, notifications_enabled, email_notifications, req.user.id]
    );
    
    if (result.rows.length === 0) {
      // If no settings exist, create them
      const insertResult = await pool.query(
        `INSERT INTO user_settings (user_id, theme, notifications_enabled, email_notifications)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [req.user.id, theme || 'light', notifications_enabled !== false, email_notifications === true]
      );
      return res.json(insertResult.rows[0]);
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user settings:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all courses (simplified list with video counts)
app.get('/api/courses', (req, res) => {
  const coursesList = coursesContent.map(course => ({
    id: course.id,
    name: course.name,
    icon: course.icon,
    videoCount: course.sections.reduce((sum, s) => sum + s.videos.length, 0)
  }));
  res.json(coursesList);
});

// Get specific course (with full course data including sections and videos)
app.get('/api/course', (req, res) => {
  const courseId = parseInt(req.query.courseId) || 1;
  const course = coursesContent.find(c => c.id === courseId);
  
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }
  
  res.json(course);
});

// Get progress
app.get('/api/progress/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const result = await pool.query(
      'SELECT * FROM progress WHERE user_id = $1 AND course_id = $2 ORDER BY video_id ASC',
      [req.user.id, courseId]
    );
    console.log(`📊 Progress for user ${req.user.id}, course ${courseId}:`, result.rows);
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
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📍 https://staff.orthotal.com`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
