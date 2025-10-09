# Screeps Code Upload Script

This script allows you to upload your `main.js` file directly to your official Screeps account using the Web API.

## Prerequisites

- `curl` (should be pre-installed on most Linux systems)
- `jq` (JSON processor) - Install with: `sudo apt-get install jq` or `sudo yum install jq`

## Setup

### Option 1: Token Authentication (Recommended)

1. Get your auth token from Screeps:
   - Go to https://screeps.com/a/#!/account/auth-tokens
   - Generate a new token with "Full Access" permissions
   - Copy the token

2. Set the environment variable:
   ```bash
   export SCREEPS_TOKEN='your_token_here'
   ```

### Option 2: Email/Password Authentication

Set your credentials as environment variables:
```bash
export SCREEPS_EMAIL='your_email@example.com'
export SCREEPS_PASSWORD='your_password'
```

## Usage

### Basic Usage

```bash
./upload-to-screeps.sh
```

### Upload to a Specific Branch

```bash
export SCREEPS_BRANCH='my-branch'
./upload-to-screeps.sh
```

### Upload to a Private Server

```bash
export SCREEPS_SERVER='https://your-private-server.com'
./upload-to-screeps.sh
```

### One-liner with Token

```bash
SCREEPS_TOKEN='your_token' ./upload-to-screeps.sh
```

## Configuration Options

All configuration can be done via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `SCREEPS_TOKEN` | Auth token (recommended) | - |
| `SCREEPS_EMAIL` | Account email | - |
| `SCREEPS_PASSWORD` | Account password | - |
| `SCREEPS_BRANCH` | Branch to upload to | `default` |
| `SCREEPS_SERVER` | Server URL | `https://screeps.com` |

## Creating a Persistent Configuration

To avoid typing credentials every time, create a file named `.screeps-config` in your home directory:

```bash
cat > ~/.screeps-config << 'EOF'
export SCREEPS_TOKEN='your_token_here'
export SCREEPS_BRANCH='default'
EOF

chmod 600 ~/.screeps-config  # Protect your credentials
```

Then source it before running the script:

```bash
source ~/.screeps-config
./upload-to-screeps.sh
```

Or add this to your `~/.bashrc` or `~/.profile`:

```bash
if [ -f ~/.screeps-config ]; then
    source ~/.screeps-config
fi
```

## Troubleshooting

### "jq: command not found"

Install jq:
```bash
# Ubuntu/Debian
sudo apt-get install jq

# CentOS/RHEL
sudo yum install jq

# macOS
brew install jq
```

### Authentication Errors

- **401 Unauthorized**: Check that your token or email/password are correct
- **403 Forbidden**: Your token may not have sufficient permissions
- **Token expired**: Generate a new token from the Screeps website

### Connection Errors

- Check that `SCREEPS_SERVER` is correct
- Ensure you have internet connectivity
- For private servers, verify the server URL is accessible

## Security Notes

- **Never commit credentials to git!** Add `.screeps-config` to your `.gitignore`
- Token authentication is more secure than email/password
- Keep your tokens safe and rotate them periodically
- Set file permissions to 600 for any credential files: `chmod 600 ~/.screeps-config`

## API Reference

This script uses the Screeps Web API endpoint:
- Endpoint: `POST /api/user/code`
- Documentation: https://docs.screeps.com/api/

## Examples

### Upload with all options

```bash
export SCREEPS_TOKEN='abc123...'
export SCREEPS_BRANCH='experimental'
export SCREEPS_SERVER='https://screeps.com'
./upload-to-screeps.sh
```

### Quick upload with inline token

```bash
SCREEPS_TOKEN='abc123...' SCREEPS_BRANCH='dev' ./upload-to-screeps.sh
```

