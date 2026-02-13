# Staff Course Platform - Deployment Log

## Project Overview
- **Goal**: Deploy staff training app (Discord OAuth + HLS video courses + progress tracking) to production
- **Domain**: https://staff.orthotal.com
- **Platform**: Railway.app + PostgreSQL
- **GitHub**: https://github.com/encoassistant-hue/staff-course-platform

## Deployment Status: COMPLETE ✅
All reported issues fixed. Platform ready for user testing.

## Latest Update (Feb 13, 23:07 GMT+1)
- **Restructured AI Static Ads course**: Combined 2 sections → 1 section with all 4 videos
- **Updated Mux URLs**: New token URLs provided by user (valid tokens)
- **Added Google Gems as resources**: 
  - Video 2: Organic Product Image Prompt Generator
  - Video 3: Portrait Generator  
  - Video 4: Scene Builder
- **Commit**: `ebeea2b` - Pushed and deployed to Railway
- **Status**: All changes saved and committed

## Critical Technical Details

### Courses
- **AI Course** (🤖): 5 videos (Section 1: 3 videos + Section 2 Video Ads: 2 videos)
- **AI Static Ads** (📸): 4 videos (Section 1 Product Images: 2 + Section 2 AI Humans: 2)

### Environment Variables (Railway)
```
DATABASE_URL=postgres://[user]:[pass]@[host]:5432/[db]
DISCORD_CLIENT_ID=1470884294720225394
DISCORD_CLIENT_SECRET=[secret in Railway vault]
JWT_SECRET=[secret in Railway vault]
MATING_SECRET=[secret in Railway vault]
NODE_ENV=production
```

### Discord Configuration
- Guild ID: 1402748481298370704
- Required Role ID: 1402763897316048956 (editors role)
- Admin Role ID: 1402763806995779737
- OAuth uses form-encoded token exchange (NOT JSON) via `qs.stringify()`

### Key Fixes Applied
1. **Discord OAuth**: Changed from JSON to `application/x-www-form-urlencoded` POST
2. **Progress API**: All calls use path parameters `/api/progress/${courseId}` (not query string)
3. **HLS Video Streaming**: Added HLS.js library for .m3u8 stream playback
4. **Progress Counting**: Filter `allUserProgress` by `course_id` AND `completed === true`
5. **Theme Persistence**: Save to localStorage immediately + database for sync; apply in `<head>` before DOMContentLoaded
6. **Login Flash Prevention**: Check token + apply theme before content renders
7. **Mobile Menu**: Close button + click-outside handler + logout at bottom
8. **Back Button**: Returns to course selection `showCourses()` not home

### Mux HLS URLs
Videos use .m3u8 format with JWT tokens valid until **Feb 13, 2026 ~12:00 UTC**
- AI Course videos: Mux playback endpoints with HLS support
- Static Ads videos: Same format

## Next Action
User must test all functionality:
- [ ] Discord login (no flash)
- [ ] Both courses load with correct video counts
- [ ] Videos play (HLS streams work)
- [ ] Progress saves (completed videos only)
- [ ] Back/logout/mobile menu work
- [ ] Theme persists on refresh
- [ ] Resume from last watched after session

## Latest Commits
- `651774d`: Progress counting fix, HLS improvements
- `46492a7`: Removed blocking script

## Important Learnings
- Discord token endpoint requires form-encoded data (not JSON)
- API path parameters must match between frontend calls and server endpoints
- HLS streams need HLS.js library (native HTML5 video won't work)
- Theme flash only fully eliminated by applying theme in `<head>` before render
- Progress must filter by both course_id AND completed status
- Mux tokens have expiration dates; regenerate before Feb 13, 2026

## Contact Points
- GitHub repo for code review
- Railway deployment logs for production errors
- Browser console for frontend validation
