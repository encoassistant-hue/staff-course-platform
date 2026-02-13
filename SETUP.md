# Training Platform - Setup & Features

## ✅ What's New

### 1. **Modern Professional UI**
- Clean, modern design with gradient backgrounds
- Professional color scheme (purple/blue gradient)
- Responsive layout for all devices
- Smooth animations and transitions
- Card-based interface for courses/certificates

### 2. **Dashboard & Navigation**
- **Home**: Welcome page with course overview
- **Courses**: Browse all available courses
- **Certificates**: View earned certificates with download option
- **Settings**: Customize your learning experience
- Sidebar navigation with icons
- Mobile-responsive hamburger menu

### 3. **Settings Page**
Users can now customize:
- **Theme**: Light/Dark mode toggle
- **Notifications**: Enable/disable in-app notifications
- **Email Notifications**: Opt in/out of email updates
- Settings persist in the database

### 4. **Discord OAuth Login** (Optional)
Complete Discord integration ready:
- Login button on signup screen
- Role-based access control
- Automatic user profile sync

## 🚀 How to Run

### Basic Setup (Username/Password)
```bash
cd staff-course-platform
npm start
# or
node server.js
```

Visit: `http://localhost:3000`

**Test Accounts:**
- Username: `staff1` / Password: `staff123`
- Username: `staff2` / Password: `staff456`

### Discord OAuth Setup (Optional)

#### Step 1: Create Discord Application
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name it: "Training Platform"
4. Go to "OAuth2" → "General"
5. Copy the **Client ID**
6. Click "Reset Secret" and copy the **Client Secret**

#### Step 2: Set Redirect URI
1. In OAuth2 section, add Redirect URL:
   - `http://localhost:3000/api/auth/discord/callback`

#### Step 3: Get Role ID
1. In your Discord server, create a role (e.g., "Course Access")
2. Right-click role → Copy User ID (or use dev tools)
3. Note the **Role ID**

#### Step 4: Get Guild ID
1. In Discord server settings, enable Developer Mode
2. Right-click your server → Copy Server ID
3. Note the **Guild ID**

#### Step 5: Set Environment Variables
Create a `.env` file in the project root:
```
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_GUILD_ID=your_guild_id_here
REQUIRED_DISCORD_ROLE_ID=your_role_id_here
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
JWT_SECRET=your_jwt_secret_here
```

Then restart the server. Discord login button will appear on the login page!

## 📊 Database Schema

The platform now tracks:
- User profiles (name, email, avatar, Discord ID)
- Course progress per user/course
- Course completion status
- User settings (theme, notifications)

Multiple courses are fully supported with independent progress tracking.

## 🎓 Features by Page

### Home
- Welcome message
- All courses with progress bars
- Quick "Continue Learning" buttons
- Progress visualization

### Courses
- Browse all available courses
- See detailed progress
- Start/continue any course
- Visual course icons and descriptions

### Certificates
- View all earned certificates
- Download certificate as PNG
- Verify completion status
- Professional certificate design

### Settings
- Appearance preferences (theme)
- Notification controls
- Email preferences
- Save changes securely

## 🎥 Course Player

When in a course:
- Video player with standard controls
- Progress tracking (90% watch threshold = completion)
- Previous/Next navigation
- Video progress visualization
- Course progress in sidebar

## 🔐 Security

- JWT-based authentication
- Token stored in localStorage
- Automatic logout on invalid token
- Discord role-based access control
- Password hashing with bcrypt

## 📱 Mobile Support

- Fully responsive design
- Touch-friendly navigation
- Hamburger menu for mobile
- Optimized video player
- Card-based layout works on all sizes

## 🛠️ Tech Stack

- **Backend**: Express.js, SQLite3, JWT
- **Frontend**: Vanilla JavaScript, Modern CSS
- **Authentication**: JWT + Discord OAuth
- **Video**: HLS streams (Mux)

## 📝 Available Courses

1. **AI Course** (🤖)
   - Section 1: Introduction to GenAI
   - Section 2: Video Ads
   - 5 videos total

2. **AI Static Ads** (📸)
   - Section 1: Product Images  
   - Section 2: AI Humans
   - 4 videos total with resources

## 🚨 Troubleshooting

### Server won't start
- Delete `data.db` and restart
- Check port 3000 is available
- Check Node.js version (v14+)

### Discord login not appearing
- Set `DISCORD_CLIENT_ID` env variable
- Discord button only shows when configured
- Test with username/password first

### Token issues
- Clear localStorage in browser DevTools
- Logout and login again
- Restart the server

## 📞 Support

If you need to:
- Add more courses: Edit `server.js` courseContent
- Customize colors: Update CSS variables in `index.html`
- Add new pages: Create in HTML, add routes in app.js
- Deploy: Set env variables on your hosting platform

---

**Version**: 2.0 (Modern UI + Discord OAuth)  
**Last Updated**: Feb 10, 2026
