#!/bin/bash

# Screeps Code Upload Script
# This script uploads main.js to your Screeps account
# 
# Usage:
#   ./upload-to-screeps.sh
#
# Configuration:
#   Set environment variables or edit the variables below:
#   - SCREEPS_EMAIL: Your Screeps account email
#   - SCREEPS_PASSWORD: Your Screeps account password
#   - SCREEPS_TOKEN: Alternative to email/password (recommended)
#   - SCREEPS_BRANCH: Branch name (default: "default")
#   - SCREEPS_SERVER: Server URL (default: "https://screeps.com")

set -e  # Exit on error

# Configuration
SCREEPS_EMAIL="${SCREEPS_EMAIL:-}"
SCREEPS_PASSWORD="${SCREEPS_PASSWORD:-}"
SCREEPS_TOKEN="${SCREEPS_TOKEN:-}"
SCREEPS_BRANCH="${SCREEPS_BRANCH:-default}"
SCREEPS_SERVER="${SCREEPS_SERVER:-https://screeps.com}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_JS="${SCRIPT_DIR}/main.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if main.js exists
if [ ! -f "$MAIN_JS" ]; then
    echo -e "${RED}Error: main.js not found at ${MAIN_JS}${NC}"
    exit 1
fi

echo -e "${YELLOW}Screeps Code Upload Script${NC}"
echo "=================================="
echo "File: $MAIN_JS"
echo "Branch: $SCREEPS_BRANCH"
echo "Server: $SCREEPS_SERVER"
echo ""

# Create a temporary file for the JSON payload
TEMP_FILE=$(mktemp)
trap "rm -f $TEMP_FILE" EXIT

# Read the main.js file and escape it for JSON
MAIN_JS_CONTENT=$(cat "$MAIN_JS" | jq -Rs .)

# Create JSON payload with proper module structure and write to temp file
cat > "$TEMP_FILE" <<EOF
{
  "branch": "$SCREEPS_BRANCH",
  "modules": {
    "main": $MAIN_JS_CONTENT
  }
}
EOF

# Prepare authentication
AUTH_HEADER=""
if [ -n "$SCREEPS_TOKEN" ]; then
    echo "Using token authentication..."
    AUTH_HEADER="X-Token: $SCREEPS_TOKEN"
elif [ -n "$SCREEPS_EMAIL" ] && [ -n "$SCREEPS_PASSWORD" ]; then
    echo "Using email/password authentication..."
    # Note: Basic auth with Screeps uses email:password
    AUTH_CREDENTIALS="$SCREEPS_EMAIL:$SCREEPS_PASSWORD"
else
    echo -e "${RED}Error: No authentication provided!${NC}"
    echo "Please set either:"
    echo "  - SCREEPS_TOKEN environment variable (recommended), or"
    echo "  - SCREEPS_EMAIL and SCREEPS_PASSWORD environment variables"
    echo ""
    echo "Example:"
    echo "  export SCREEPS_TOKEN='your_token_here'"
    echo "  ./upload-to-screeps.sh"
    exit 1
fi

# Upload the code
echo "Uploading code to Screeps..."

if [ -n "$SCREEPS_TOKEN" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d @"$TEMP_FILE" \
        "$SCREEPS_SERVER/api/user/code")
else
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -u "$AUTH_CREDENTIALS" \
        -d @"$TEMP_FILE" \
        "$SCREEPS_SERVER/api/user/code")
fi

# Parse response
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

# Check response
if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Code uploaded successfully!${NC}"
    echo "Response: $RESPONSE_BODY"
    exit 0
else
    echo -e "${RED}✗ Upload failed with HTTP code: $HTTP_CODE${NC}"
    echo "Response: $RESPONSE_BODY"
    exit 1
fi

