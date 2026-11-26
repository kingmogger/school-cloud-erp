import { Router } from 'express';
import { getFirebaseInfo, getDb } from '../config/firebase.js';
import { ALL_MODELS } from '../models/allModels.js';
import { sendSuccess, sendError } from '../utils/ApiResponse.js';
import { runSeed } from '../seeds/seed.js';

const router = Router();

// GET /api/v1/database/stats - Global stats & collection list
router.get('/stats', async (req, res) => {
  try {
    const info = getFirebaseInfo();
    const collectionStats = [];

    for (const [name, model] of Object.entries(ALL_MODELS)) {
      try {
        const count = await model.countDocuments();
        collectionStats.push({
          name,
          count,
          hasTenant: model.hasTenant,
        });
      } catch (err) {
        collectionStats.push({ name, count: 0, error: err.message });
      }
    }

    const totalDocs = collectionStats.reduce((sum, c) => sum + (c.count || 0), 0);

    return sendSuccess(res, {
      ...info,
      totalDocuments: totalDocs,
      collections: collectionStats,
      supportedCollections: Object.keys(ALL_MODELS),
    });
  } catch (err) {
    return sendError(res, 500, 'DB_STATS_ERROR', err.message);
  }
});

// GET /api/v1/database/:collection - List documents in collection
router.get('/:collection', async (req, res) => {
  const { collection } = req.params;
  const model = ALL_MODELS[collection];

  if (!model) {
    return sendError(res, 404, 'COLLECTION_NOT_FOUND', `Collection '${collection}' does not exist.`);
  }

  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const search = req.query.search ? String(req.query.search).trim() : '';

    const all = await model.find({}).exec();
    let filtered = all;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = all.filter((doc) => {
        return Object.values(doc).some((val) => {
          if (val === null || val === undefined) return false;
          if (typeof val === 'object') return JSON.stringify(val).toLowerCase().includes(searchLower);
          return String(val).toLowerCase().includes(searchLower);
        });
      });
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return sendSuccess(res, {
      collection,
      items: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return sendError(res, 500, 'FETCH_COLLECTION_ERROR', err.message);
  }
});

// GET /api/v1/database/:collection/:id - Get single document
router.get('/:collection/:id', async (req, res) => {
  const { collection, id } = req.params;
  const model = ALL_MODELS[collection];

  if (!model) {
    return sendError(res, 404, 'COLLECTION_NOT_FOUND', `Collection '${collection}' does not exist.`);
  }

  try {
    const doc = await model.findById(id).exec();
    if (!doc) {
      return sendError(res, 404, 'DOCUMENT_NOT_FOUND', `Document with ID '${id}' not found.`);
    }
    return sendSuccess(res, doc);
  } catch (err) {
    return sendError(res, 500, 'FETCH_DOCUMENT_ERROR', err.message);
  }
});

// POST /api/v1/database/:collection - Create document
router.post('/:collection', async (req, res) => {
  const { collection } = req.params;
  const model = ALL_MODELS[collection];

  if (!model) {
    return sendError(res, 404, 'COLLECTION_NOT_FOUND', `Collection '${collection}' does not exist.`);
  }

  try {
    const created = await model.create(req.body);
    return sendSuccess(res, created, 'Document created successfully');
  } catch (err) {
    return sendError(res, 400, 'CREATE_DOCUMENT_ERROR', err.message);
  }
});

// PUT /api/v1/database/:collection/:id - Update document
router.put('/:collection/:id', async (req, res) => {
  const { collection, id } = req.params;
  const model = ALL_MODELS[collection];

  if (!model) {
    return sendError(res, 404, 'COLLECTION_NOT_FOUND', `Collection '${collection}' does not exist.`);
  }

  try {
    const updated = await model.findByIdAndUpdate(id, req.body, { upsert: true });
    return sendSuccess(res, updated, 'Document updated successfully');
  } catch (err) {
    return sendError(res, 400, 'UPDATE_DOCUMENT_ERROR', err.message);
  }
});

// DELETE /api/v1/database/:collection/:id - Delete document
router.delete('/:collection/:id', async (req, res) => {
  const { collection, id } = req.params;
  const model = ALL_MODELS[collection];

  if (!model) {
    return sendError(res, 404, 'COLLECTION_NOT_FOUND', `Collection '${collection}' does not exist.`);
  }

  try {
    const deleted = await model.findByIdAndDelete(id);
    return sendSuccess(res, { id, deleted: !!deleted }, 'Document deleted successfully');
  } catch (err) {
    return sendError(res, 500, 'DELETE_DOCUMENT_ERROR', err.message);
  }
});

// POST /api/v1/database/seed - Seed database on demand
router.post('/seed/run', async (req, res) => {
  try {
    await runSeed({ closeConnection: false });
    return sendSuccess(res, { status: 'seeded' }, 'Database seeded successfully with demo users and schools');
  } catch (err) {
    return sendError(res, 500, 'SEED_ERROR', err.message);
  }
});

export default router;
