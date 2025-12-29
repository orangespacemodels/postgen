#!/bin/bash
# E2E Test: Post MiniApp Image Generation
# Scenario: "Юмористическое поздравление с НГ" -> improve prompt -> generate image
# Expected: Image should be sent to Telegram for user_id=65

set -e

USER_ID=65
TG_CHAT_ID=65
BASE_URL="https://n8n.orangespace.io/webhook"
INITIAL_PROMPT="Юмористическое поздравление с Новым Годом"

echo "======================================"
echo "E2E Test: Post MiniApp Image Generation"
echo "======================================"
echo "User ID: $USER_ID"
echo "Initial Prompt: $INITIAL_PROMPT"
echo ""

# Step 1: Improve Prompt
echo "🪄 Step 1: Improving prompt..."
IMPROVED_RESPONSE=$(curl -s -X POST "$BASE_URL/post-magic-improve" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"$INITIAL_PROMPT\", \"user_id\": $USER_ID}")

echo "Response: $IMPROVED_RESPONSE"

# Extract improved prompt and escape it for JSON
IMPROVED_PROMPT=$(echo "$IMPROVED_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    prompt = data.get('improved_prompt', data.get('prompt', ''))
    # Remove outer quotes if present
    prompt = prompt.strip('\"')
    print(prompt)
except Exception as e:
    print('')
" 2>/dev/null || echo "")

if [ -z "$IMPROVED_PROMPT" ]; then
    IMPROVED_PROMPT="$INITIAL_PROMPT"
fi

echo ""
echo "✅ Improved prompt: $IMPROVED_PROMPT"
echo ""

# Step 2: Generate Text (optional, for context)
echo "📝 Step 2: Generating text..."

# Use Python to safely create JSON
TEXT_RESPONSE=$(python3 -c "
import urllib.request
import json
import sys

data = {
    'prompt': '''$IMPROVED_PROMPT''',
    'user_id': $USER_ID,
    'tg_chat_id': $TG_CHAT_ID
}

req = urllib.request.Request(
    '$BASE_URL/post-generate-text',
    data=json.dumps(data).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    with urllib.request.urlopen(req, timeout=60) as response:
        print(response.read().decode('utf-8'))
except Exception as e:
    print(json.dumps({'error': str(e)}))
" 2>&1)

echo "Response: $TEXT_RESPONSE"

GENERATED_TEXT=$(echo "$TEXT_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    text = data.get('text', '')
    # Escape for JSON
    print(text[:500] if text else '')
except:
    print('')
" 2>/dev/null || echo "")

echo ""
echo "✅ Generated text: ${GENERATED_TEXT:0:200}..."
echo ""

# Step 3: Generate Image
echo "🖼️ Step 3: Generating image with Gemini Nano Banana..."
echo "This may take 30-60 seconds..."
echo ""

# Use Python to safely create JSON and make request
IMAGE_RESPONSE=$(python3 -c "
import urllib.request
import json
import sys

data = {
    'prompt': '''$IMPROVED_PROMPT''',
    'user_id': $USER_ID,
    'tg_chat_id': $TG_CHAT_ID,
    'generated_text': '''$GENERATED_TEXT'''
}

req = urllib.request.Request(
    '$BASE_URL/post-generate-image-v2',
    data=json.dumps(data).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    with urllib.request.urlopen(req, timeout=120) as response:
        print(response.read().decode('utf-8'))
except Exception as e:
    print(json.dumps({'error': str(e)}))
" 2>&1)

echo "Response: $IMAGE_RESPONSE"
echo ""

# Parse result
SUCCESS=$(echo "$IMAGE_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print('true' if data.get('success') or data.get('image_url') else 'false')
except:
    print('false')
" 2>/dev/null || echo "false")

IMAGE_URL=$(echo "$IMAGE_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('image_url', 'N/A'))
except:
    print('N/A')
" 2>/dev/null || echo "N/A")

echo "======================================"
if [ "$SUCCESS" = "true" ]; then
    echo "✅ TEST PASSED!"
    echo "Image URL: $IMAGE_URL"
    echo ""
    echo "📱 Check your Telegram - image should be sent to chat $TG_CHAT_ID"
else
    echo "❌ TEST FAILED!"
    echo "Response: $IMAGE_RESPONSE"
fi
echo "======================================"
