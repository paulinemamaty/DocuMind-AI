# Google Cloud Credentials Setup

## Security Best Practice

Instead of storing your service account key as a file in the repository (security risk!), we use base64 encoding to store it as an environment variable.

## Setup Instructions

### 1. Get your Service Account Key

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to "IAM & Admin" → "Service Accounts"
3. Find your Document AI service account
4. Click "Keys" → "Add Key" → "Create new key"
5. Choose JSON format
6. Download the key file (keep it secure!)

### 2. Convert to Base64

#### On macOS/Linux:
```bash
# Convert the JSON file to base64 (single line)
base64 -i service-account-key.json | tr -d '\n' > credentials.txt

# Copy the content
cat credentials.txt
```

#### On Windows (PowerShell):
```powershell
# Convert the JSON file to base64
$bytes = [System.IO.File]::ReadAllBytes("service-account-key.json")
$base64 = [Convert]::ToBase64String($bytes)
$base64 | Out-File -FilePath credentials.txt -NoNewline

# Display the content
Get-Content credentials.txt
```

### 3. Add to Environment Variables

1. Open your `.env.local` file
2. Add the base64 string:
```env
GCP_CREDENTIALS_BASE64=<paste-your-base64-string-here>
```

3. **DELETE** the original JSON file - never commit it to git!
```bash
rm service-account-key.json
rm credentials.txt  # Also delete the temporary base64 file
```

### 4. Verify Setup

Test that your credentials are working:
```bash
npm run dev
# Navigate to a document and test Document AI features
```

## For Production Deployment

### Vercel
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add `GCP_CREDENTIALS_BASE64` with your base64 string
4. Deploy

### Heroku
```bash
heroku config:set GCP_CREDENTIALS_BASE64="<your-base64-string>"
```

### Docker
Add to your docker-compose.yml or pass as build arg:
```yaml
environment:
  - GCP_CREDENTIALS_BASE64=${GCP_CREDENTIALS_BASE64}
```

## Troubleshooting

### "Failed to parse GCP credentials from base64"
- Ensure the base64 string is on a single line (no line breaks)
- Verify the original JSON was valid
- Check that the entire string was copied

### "Document AI not working"
- Verify all processor IDs are set in .env.local
- Check that the service account has Document AI permissions
- Ensure billing is enabled on your GCP project

## Security Notes

- **NEVER** commit the service account JSON file to git
- **NEVER** share your base64 credentials publicly
- Rotate credentials regularly
- Use different service accounts for dev/staging/production
- Consider using Workload Identity Federation for GKE deployments