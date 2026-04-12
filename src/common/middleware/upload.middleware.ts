import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directories exist
const chefDocsDir = path.join(process.cwd(), 'uploads', 'chef-documents');
const mealsDir = path.join(process.cwd(), 'uploads', 'meals');
const proofsDir = path.join(process.cwd(), 'uploads', 'proofs');

[chefDocsDir, mealsDir, proofsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'meal_image') {
      cb(null, mealsDir);
    } else if (file.fieldname === 'batch_proof') {
      cb(null, proofsDir);
    } else {
      cb(null, chefDocsDir);
    }
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and PDF files are allowed.'));
  }
};

export const chefDocumentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
  },
});

export const mealImageUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max for dish images
  },
});

export const batchProofUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max for batch proof
  },
});
