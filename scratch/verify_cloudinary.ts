import 'dotenv/config';
import crypto from 'crypto';

function parseCloudinaryUrl() {
  const rawUrl = process.env.CLOUDINARY_URL?.trim();
  if (!rawUrl) return null;
  const url = new URL(rawUrl);
  return {
    cloudName: url.hostname,
    apiKey: decodeURIComponent(url.username),
    apiSecret: decodeURIComponent(url.password),
  };
}

function mask(value?: string) {
  if (!value) return '(missing)';
  return `${value.slice(0, 4)}...${value.slice(-4)} len=${value.length}`;
}

async function main() {
  const cloudinaryUrl = parseCloudinaryUrl();
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() || cloudinaryUrl?.cloudName;
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() || cloudinaryUrl?.apiKey;
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() || cloudinaryUrl?.apiSecret;

  console.log('Cloudinary credential check');
  console.log('cloud_name:', mask(cloudName));
  console.log('api_key:', mask(apiKey));
  console.log('api_secret:', mask(apiSecret));
  console.log('has CLOUDINARY_URL:', Boolean(process.env.CLOUDINARY_URL?.trim()));

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Missing Cloudinary credentials');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = 'homey/credential-test';
  const stringToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash('sha1')
    .update(`${stringToSign}${apiSecret}`)
    .digest('hex');

  const tinyPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

  const formData = new FormData();
  formData.append('file', tinyPng);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('folder', folder);
  formData.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  console.log('HTTP status:', response.status);
  console.log('Response:', data);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
