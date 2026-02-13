require('dotenv').config();

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
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

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('./data.db', (err) => {
  if (err) console.error(err);
  else console.log('Connected to SQLite database');
});

// Initialize database tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    name TEXT NOT NULL,
    email TEXT,
    discord_id TEXT UNIQUE,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    section_id INTEGER NOT NULL,
    video_id INTEGER NOT NULL,
    completed BOOLEAN DEFAULT 0,
    watched_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, course_id, video_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, course_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    theme TEXT DEFAULT 'dark',
    notifications_enabled BOOLEAN DEFAULT 1,
    email_notifications BOOLEAN DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Insert default staff accounts for testing
  const hashedPassword1 = bcrypt.hashSync('staff123', 10);
  const hashedPassword2 = bcrypt.hashSync('staff456', 10);
  
  db.run(`INSERT OR IGNORE INTO users (username, password, name) VALUES (?, ?, ?)`,
    ['staff1', hashedPassword1, 'Staff Member 1'], (err) => {
      if (err) console.error('Error inserting staff1:', err);
      else console.log('staff1 user ensured');
    });
  db.run(`INSERT OR IGNORE INTO users (username, password, name) VALUES (?, ?, ?)`,
    ['staff2', hashedPassword2, 'Staff Member 2'], (err) => {
      if (err) console.error('Error inserting staff2:', err);
      else console.log('staff2 user ensured');
    });
});

// Courses content - supports multiple courses
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
            url: 'https://stream.mux.com/HMLqxxvqSX7iiT3UxyOfzANdWT02TWnA00fK2sjziMPUg.m3u8?token=eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJITUxxeHh2cVNYN2lpVDNVeHlPZnpBTmRXVDAyVFduQTAwZksyc2p6aU1QVWciLCJleHAiOjE3NzMxODcyMDAsImtpZCI6IjJIeEtWQlZSWGRDMDFpNDZ4MDBNR09KMngxaXM4QjAyUlpDRFlCd2taOGp4TUEiLCJhdWQiOiJ2In0.WgvCXrTdr9BPXK-88_L6l5QFGvaw8wBC7LS5Pkg0p92Ywa-tGmflp82vZr99yrgQdDnsOB53bzEyWQKcw6KfuT01zB6R-hhxesc6zP98_BZ-_rSFYHiOXasQDsCPHaaMeM0PQc_0GR_aohTlVLKj-nuPHi3EtDMZl3fEF3sD7cq9Zzf5btFtpGUHvRQuQK0u9rb8YcxiqpPjxUeEdfI8waJ2bs3INb_kgmclvilqHPRUQyZLIwtcfqsoZPWgyMHJt3w-i0fEFAs41kyiWHJD3Du-v86Mzomp_vCyQ8nPm_gV0yR512_VfIB9ixerT6P0jzAQVk6GqCpCLwpKLufmFQ'
          },
          {
            id: 7,
            title: 'How To Generate Organic Product Images',
            url: 'https://stream.mux.com/PURHJG502d8nQ01IBY41NHeE7hHnJz6mDQnT01nKGc63As.m3u8?token=eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJQVVJISkc1MDJkOG5RMDFJQlk0MU5IZUU3aEhuSno2bURRblQwMW5LR2M2M0FzIiwiZXhwIjoxNzczMTg3MjAwLCJraWQiOiIySHhLVkJWUlhkQzAxaTQ2eDAwTUdPSjJ4MWlzOEIwMlJaQ0RZQndrWjhqeE1BIiwiYXVkIjoidiJ9.IsOeZVZfBRfhIuqID3o3DWZUCDHXq5E9M2o_gMYUVyxlUOJESZchsGGp689pVCYxfLwflcNzRLgHqZwlDpkDNs_y6-KJijuUGiN9HiQu4b_Y9ISuwgqUBxtulH6M62ZJmINx_bgsu0zOluOU612tQfTv-4ef0gh1HSSR8r6S3hFBRqD6FjCmjh4ix6-PG0ajhncLXnPg3zjY0MQBwKjCsh-nffoWNp54ANF7KHoRbTRrJifqhC6rVKN2Fjrlk1x3Vok8OnyjKN5vNzKf3-kmTIhX_bDhPXTJQ0AlIHE1DVZD2keLhhULndOiuBkBQ3rEmj8lTt1qQ1OskXs6qmhpkg',
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
            url: 'https://stream.mux.com/jIxL5IaqPBzlAqNdxvwBv9pSVRvjwsZMkAMSlN900ngo.m3u8?token=eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJqSXhMNUlhcVBCemxBcU5keHZ3QnY5cFNWUnZqd3NaTWtBTVNsTjkwMG5nbyIsImV4cCI6MTc3MzE4NzIwMCwia2lkIjoiMkh4S1ZCVlJYZEMwMWk0NngwME1HT0oyeDFpczhCMDJSWkNEWUJ3a1o4anhNQSIsImF1ZCI6InYifQ.uW8aIZ2jUzPsSYq7lbI1JeOu1wkf2BXOt2E5SIqPXhBGLe68pUlVPszFkzAoP0MPs04WvjrIfDpuP6IJIaHYiaFseVSLOoLlXM6yu6JcUv4OklrWyRge4n2_GfGlETd3sgJDfDZBnqKvVD6NTkb1Z_0pZIJGVy8x7z6mXAgEZ_tBGrqrMYreEoKR8DoMxdewc37QzbCMk0KlEWvAgqrXMcIFx6XGk9V_oSDjsK1z1bVb0cPJYjFD5tk0xyljU7BMeJlpOuX5VJEgakTnCvto9Qxv60mY8l8g7Q5eg4jFnXGamgGary_H9LS4ns9NCtVmYc6145btWebaE4wYvMi9cg',
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
            url: 'https://stream.mux.com/lhhx569NykSowP00FQdlLbjQdSIZU4lNsi4J4E01301zeA.m3u8?token=eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJsaGh4NTY5TnlrU293UDAwRlFkbExialFkU0laVTRsTnNpNEo0RTAxMzAxemVBIiwiZXhwIjoxNzczMTg3MjAwLCJraWQiOiIySHhLVkJWUlhkQzAxaTQ2eDAwTUdPSjJ4MWlzOEIwMlJaQ0RZQndrWjhqeE1BIiwiYXVkIjoidiJ9.MezgoV8UiruttHYq8s3C_WjjEgAo2Q76my7LuOu95BWPlYdN-rnQn3KWG_vMrTVOFrZSjU2tV5Dtx1aJt6YWwup9V1fZaaGSLaVu2n3FeuHXok1nIrcrOlb0ElcWYROTHWQ9L6VaplS-eDmiXjyd7UjOOkJZrfUTKh4PWOKNeOjMm0fl0K8LlbclVMQzje09wbz_5OJlZ5kRGaUMRq73wSiBz0ftxCBvcHSWnJZvJFQ6Hznm6VaRT6OA_3jW4MsYoiQ--DDDNkpmnUnJ42Sqw8eWEJoqI5ZB0BqCTCEhtdcX9Mr3sDoFhYp6gKsbvhdkzGO-EEyBtZY0oIz7JVP8nQ',
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

// Routes

// Check if Discord is configured
app.get('/api/config', (req, res) => {
  res.json({
    discord_enabled: !!DISCORD_CLIENT_ID,
    debug: {
      client_id: DISCORD_CLIENT_ID ? DISCORD_CLIENT_ID.substring(0, 8) + '...' : 'not set',
      redirect_uri: DISCORD_REDIRECT_URI,
      guild_id: DISCORD_GUILD_ID ? DISCORD_GUILD_ID : 'not set',
      role_id: REQUIRED_DISCORD_ROLE_ID ? REQUIRED_DISCORD_ROLE_ID : 'not set'
    }
  });
});

// Debug: Check Discord configuration
app.get('/api/debug/discord-config', (req, res) => {
  res.json({
    message: 'Discord Configuration Check',
    clientId: DISCORD_CLIENT_ID || 'NOT SET',
    clientSecret: DISCORD_CLIENT_SECRET ? '***' + DISCORD_CLIENT_SECRET.slice(-4) : 'NOT SET',
    redirectUri: DISCORD_REDIRECT_URI,
    guildId: DISCORD_GUILD_ID || 'NOT SET',
    roleId: REQUIRED_DISCORD_ROLE_ID || 'NOT SET',
    allConfigured: !!(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET && DISCORD_REDIRECT_URI)
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt for username:', username);
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
    
    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const passwordMatch = bcrypt.compareSync(password, user.password);
    console.log('Password match:', passwordMatch);
    
    if (!passwordMatch) {
      console.log('Password mismatch for user:', username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Update last_login
    db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    
    const token = jwt.sign({ id: user.id, username: user.username, name: user.name }, JWT_SECRET);
    console.log('Login successful for:', username);
    res.json({ token, user: { id: user.id, username: user.username, name: user.name } });
  });
});

// Discord OAuth initiate
app.get('/api/auth/discord', (req, res) => {
  if (!DISCORD_CLIENT_ID) {
    return res.status(400).json({ error: 'Discord login not configured' });
  }
  
  console.log('Starting Discord OAuth flow...');
  console.log('Client ID:', DISCORD_CLIENT_ID);
  console.log('Redirect URI:', DISCORD_REDIRECT_URI);
  
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email guilds.members.read'
  });
  
  const authUrl = `https://discord.com/api/oauth2/authorize?${params}`;
  console.log('Redirecting to:', authUrl);
  res.redirect(authUrl);
});

// Discord OAuth callback
app.get('/api/auth/discord/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return res.redirect(`/?error=${error}`);
  }
  
  if (!code) {
    return res.redirect('/?error=no_code');
  }
  
  try {
    console.log('Discord OAuth callback - Code:', code ? 'present' : 'missing');
    console.log('Discord OAuth callback - Client ID:', DISCORD_CLIENT_ID);
    console.log('Discord OAuth callback - Redirect URI:', DISCORD_REDIRECT_URI);
    
    // Exchange code for token
    console.log('Exchanging code for token...');
    console.log('Token request params:');
    console.log('  - Client ID:', DISCORD_CLIENT_ID);
    console.log('  - Code:', code ? code.substring(0, 10) + '...' : 'missing');
    console.log('  - Redirect URI:', DISCORD_REDIRECT_URI);
    
    const tokenData = new URLSearchParams();
    tokenData.append('client_id', DISCORD_CLIENT_ID);
    tokenData.append('client_secret', DISCORD_CLIENT_SECRET);
    tokenData.append('code', code);
    tokenData.append('grant_type', 'authorization_code');
    tokenData.append('redirect_uri', DISCORD_REDIRECT_URI);
    
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      tokenData
    );
    
    console.log('Token response received successfully');
    const { access_token } = tokenResponse.data;
    
    // Get user info
    const userResponse = await axios.get(
      'https://discord.com/api/users/@me',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    
    const discordUser = userResponse.data;
    console.log('Discord user authenticated:', discordUser.username, 'ID:', discordUser.id);
    
    // Check role if required
    if ((REQUIRED_DISCORD_ROLE_ID || ADMIN_DISCORD_ROLE_ID) && DISCORD_GUILD_ID) {
      try {
        const memberResponse = await axios.get(
          `https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`,
          { headers: { Authorization: `Bearer ${access_token}` } }
        );
        
        console.log('Discord user roles:', memberResponse.data.roles);
        console.log('Required role ID:', REQUIRED_DISCORD_ROLE_ID);
        console.log('Admin role ID:', ADMIN_DISCORD_ROLE_ID);
        
        const hasRequiredRole = REQUIRED_DISCORD_ROLE_ID && memberResponse.data.roles.includes(REQUIRED_DISCORD_ROLE_ID.toString());
        const hasAdminRole = ADMIN_DISCORD_ROLE_ID && memberResponse.data.roles.includes(ADMIN_DISCORD_ROLE_ID.toString());
        
        console.log('Has required role:', hasRequiredRole);
        console.log('Has admin role:', hasAdminRole);
        
        if (!hasRequiredRole && !hasAdminRole) {
          console.log('User does not have required role or admin role');
          return res.redirect('/?error=missing_role');
        }
      } catch (roleError) {
        console.error('Error checking role:', roleError.message);
        if (roleError.response?.status === 404) {
          console.log('User not found in guild or guild not accessible');
          return res.redirect('/?error=not_in_guild');
        }
        return res.redirect('/?error=role_check_failed');
      }
    }
    
    // Get or create user
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;
    
    db.get('SELECT * FROM users WHERE discord_id = ?', [discordUser.id], (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.redirect('/?error=db_error');
      }
      
      if (user) {
        // Update existing user
        db.run(
          'UPDATE users SET name = ?, email = ?, avatar_url = ?, last_login = CURRENT_TIMESTAMP WHERE id = ?',
          [discordUser.username, discordUser.email, avatarUrl, user.id]
        );
        
        const token = jwt.sign({ id: user.id, username: user.username, name: user.name }, JWT_SECRET);
        return res.redirect(`/?token=${token}`);
      } else {
        // Create new user
        db.run(
          'INSERT INTO users (discord_id, name, email, avatar_url, last_login) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
          [discordUser.id, discordUser.username, discordUser.email, avatarUrl],
          function(err) {
            if (err) {
              console.error('Error creating user:', err);
              return res.redirect('/?error=create_user_error');
            }
            
            // Create default settings
            db.run('INSERT INTO user_settings (user_id) VALUES (?)', [this.lastID]);
            
            const token = jwt.sign(
              { id: this.lastID, username: discordUser.username, name: discordUser.username },
              JWT_SECRET
            );
            return res.redirect(`/?token=${token}`);
          }
        );
      }
    });
  } catch (error) {
    console.error('Discord auth error:', error.message);
    console.error('Error status:', error.response?.status);
    console.error('Error data:', error.response?.data);
    console.error('Full error:', error);
    res.redirect('/?error=auth_error');
  }
});

// Middleware to verify JWT
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get course structure (all courses or specific course)
app.get('/api/course', authMiddleware, (req, res) => {
  const courseId = req.query.courseId ? parseInt(req.query.courseId) : 1;
  const course = coursesContent.find(c => c.id === courseId);
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }
  res.json(course);
});

// Get all courses (for course selection)
app.get('/api/courses', authMiddleware, (req, res) => {
  res.json(coursesContent.map(c => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    videoCount: c.sections.reduce((sum, s) => sum + s.videos.length, 0)
  })));
});

// Get user profile
app.get('/api/user', authMiddleware, (req, res) => {
  db.get('SELECT id, username, name, email, avatar_url, discord_id FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

// Get user settings
app.get('/api/user/settings', authMiddleware, (req, res) => {
  db.get('SELECT * FROM user_settings WHERE user_id = ?', [req.user.id], (err, settings) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json(settings || {});
  });
});

// Update user settings
app.post('/api/user/settings', authMiddleware, (req, res) => {
  const { theme, notifications_enabled, email_notifications } = req.body;
  
  db.run(
    `INSERT OR REPLACE INTO user_settings (user_id, theme, notifications_enabled, email_notifications, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [req.user.id, theme, notifications_enabled, email_notifications],
    (err) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      res.json({ success: true });
    }
  );
});

// Get user progress for a course
app.get('/api/progress', authMiddleware, (req, res) => {
  const courseId = req.query.courseId ? parseInt(req.query.courseId) : 1;
  db.all('SELECT * FROM progress WHERE user_id = ? AND course_id = ?', [req.user.id, courseId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json(rows || []);
  });
});

// Mark video as watched
app.post('/api/video-watched', authMiddleware, (req, res) => {
  const { course_id, section_id, video_id } = req.body;
  const courseId = course_id || 1;
  const now = new Date().toISOString();
  
  db.run(
    `INSERT OR REPLACE INTO progress (user_id, course_id, section_id, video_id, completed, watched_at) 
     VALUES (?, ?, ?, ?, 1, ?)`,
    [req.user.id, courseId, section_id, video_id, now],
    (err) => {
      if (err) {
        console.error('Error marking video watched:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      
      // Find the course and check if all videos are completed
      const course = coursesContent.find(c => c.id === courseId);
      const totalVideos = course.sections.reduce((sum, s) => sum + s.videos.length, 0);
      
      db.get(
        'SELECT COUNT(*) as completed FROM progress WHERE user_id = ? AND course_id = ? AND completed = 1',
        [req.user.id, courseId],
        (err, row) => {
          if (row.completed === totalVideos) {
            // Mark as fully completed
            db.run(
              'INSERT OR IGNORE INTO completions (user_id, course_id) VALUES (?, ?)',
              [req.user.id, courseId]
            );
          }
          res.json({ success: true });
        }
      );
    }
  );
});

// Check if user completed a course
app.get('/api/completion-status', authMiddleware, (req, res) => {
  const courseId = req.query.courseId ? parseInt(req.query.courseId) : 1;
  db.get('SELECT * FROM completions WHERE user_id = ? AND course_id = ?', [req.user.id, courseId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json({ completed: !!row, completedAt: row?.completed_at });
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Staff course platform running on http://localhost:${PORT}`);
  console.log(`Discord Login: ${DISCORD_CLIENT_ID ? 'Enabled' : 'Disabled'}`);
  if (!DISCORD_CLIENT_ID) {
    console.log('To enable Discord login, set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET env vars');
  }
});
