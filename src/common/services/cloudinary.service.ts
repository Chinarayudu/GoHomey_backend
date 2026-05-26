import crypto from 'crypto';

type CloudinaryUploadResponse = {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format?: string;
  bytes?: number;
  original_filename?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    const error: any = new Error(`${name} is not configured`);
    error.status = 500;
    throw error;
  }
  return value;
}

function parseCloudinaryUrl() {
  const rawUrl = process.env.CLOUDINARY_URL?.trim();
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    return {
      cloudName: url.hostname,
      apiKey: decodeURIComponent(url.username),
      apiSecret: decodeURIComponent(url.password),
    };
  } catch {
    const error: any = new Error('CLOUDINARY_URL is invalid');
    error.status = 500;
    throw error;
  }
}

function signUploadParams(params: Record<string, string>, apiSecret: string) {
  const stringToSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto.createHash('sha1').update(`${stringToSign}${apiSecret}`).digest('hex');
}

function maskCredential(value?: string) {
  if (!value) return '(missing)';
  return `${value.slice(0, 4)}...${value.slice(-4)} len=${value.length}`;
}

export class CloudinaryService {
  private get cloudinaryUrl() {
    return parseCloudinaryUrl();
  }

  private get cloudName() {
    return process.env.CLOUDINARY_CLOUD_NAME?.trim() || this.cloudinaryUrl?.cloudName || requireEnv('CLOUDINARY_CLOUD_NAME');
  }

  private get apiKey() {
    return process.env.CLOUDINARY_API_KEY?.trim() || this.cloudinaryUrl?.apiKey || requireEnv('CLOUDINARY_API_KEY');
  }

  private get apiSecret() {
    return process.env.CLOUDINARY_API_SECRET?.trim() || this.cloudinaryUrl?.apiSecret || requireEnv('CLOUDINARY_API_SECRET');
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<CloudinaryUploadResponse> {
    if (!file?.buffer?.length) {
      const error: any = new Error('Uploaded file is empty');
      error.status = 400;
      throw error;
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const paramsToSign = {
      folder,
      timestamp,
    };
    const signature = signUploadParams(paramsToSign, this.apiSecret);

    const fileBytes = new Uint8Array(file.buffer.length);
    fileBytes.set(file.buffer);

    const formData = new FormData();
    formData.append('file', new Blob([fileBytes], { type: file.mimetype }), file.originalname);
    formData.append('api_key', this.apiKey);
    formData.append('timestamp', timestamp);
    formData.append('folder', folder);
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`,
      {
        method: 'POST',
        body: formData,
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Cloudinary Upload Error]', {
        cloud_name: maskCredential(this.cloudName),
        api_key: maskCredential(this.apiKey),
        api_secret: maskCredential(this.apiSecret),
        has_cloudinary_url: Boolean(process.env.CLOUDINARY_URL?.trim()),
        folder,
        status: response.status,
        response: data,
      });
      const message =
        (data as { error?: { message?: string } }).error?.message ||
        `Cloudinary upload failed (${response.status})`;
      const error: any = new Error(message);
      error.status = response.status;
      error.details = data;
      throw error;
    }

    return data as CloudinaryUploadResponse;
  }
}

export const cloudinaryService = new CloudinaryService();
