#!/bin/bash

# Railway Environment Variables Setup Script
# This script sets all required environment variables for staff-course-platform

TOKEN="717f866d-a9ac-40a8-a27a-12c30dcd20dd"
PROJECT_ID="497f17de-73c3-483f-b0f3-11a068368852"
ENV_ID="76eedb51-f100-470a-95de-60e08d283b6f"

echo "🚀 Setting up Railway environment variables..."
echo ""

# Array of variables to set
declare -A VARS=(
  ["NODE_ENV"]="production"
  ["DISCORD_CLIENT_ID"]="1470884294720225394"
  ["DISCORD_CLIENT_SECRET"]="pBulvksBAv2tE0NSGbNccaUg0YfaJhh8"
  ["DISCORD_REDIRECT_URI"]="https://staff.orthotal.com/api/auth/discord/callback"
  ["DISCORD_GUILD_ID"]="1402748481298370704"
  ["REQUIRED_DISCORD_ROLE_ID"]="1402763897316048956"
  ["ADMIN_DISCORD_ROLE_ID"]="1402763806995779737"
  ["JWT_SECRET"]="training-platform-secret-key-2026"
)

SUCCESS=0
FAILED=0

# Set each variable
for KEY in "${!VARS[@]}"; do
  VALUE="${VARS[$KEY]}"
  
  # Escape quotes in value for JSON
  VALUE_ESCAPED=$(echo "$VALUE" | sed 's/"/\\"/g')
  
  echo -n "Setting $KEY... "
  
  # Call Railway API
  RESPONSE=$(curl -s -X POST https://api.railway.app/graphql \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"mutation { variableUpsert(input: {projectId: \\\"$PROJECT_ID\\\", environmentId: \\\"$ENV_ID\\\", key: \\\"$KEY\\\", value: \\\"$VALUE_ESCAPED\\\"}) { variable { id key } } }\"}")
  
  # Check if successful
  if echo "$RESPONSE" | grep -q '"key":"'"$KEY"'"'; then
    echo "✅"
    ((SUCCESS++))
  else
    echo "⚠️ (may still work - check Railway dashboard)"
    ((FAILED++))
  fi
done

echo ""
echo "================================"
echo "✅ Setup complete!"
echo "   Success: $SUCCESS variables"
echo "   Issues: $FAILED variables"
echo "================================"
echo ""
echo "Your app will restart automatically in Railway."
echo "Check the logs to confirm everything is running!"
echo ""
