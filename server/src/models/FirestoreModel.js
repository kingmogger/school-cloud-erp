import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '../config/firebase.js';
import { getCurrentSchoolId, getTenantStore } from '../utils/tenantContext.js';

const REF_COLLECTIONS = {
  userId: 'users',
  studentId: 'students',
  facultyId: 'faculties',
  parentId: 'parents',
  parentIds: 'parents',
  classId: 'classes',
  sectionId: 'sections',
  subjectId: 'subjects',
  academicYearId: 'academicYears',
  planId: 'subscriptionPlans',
  examId: 'exams',
  assignmentId: 'assignments',
  schoolId: 'schools',
  classTeacherId: 'faculties',
  currentAcademicYearId: 'academicYears',
  children: 'students',
};

function matchesQuery(doc, query = {}) {
  if (!query || Object.keys(query).length === 0) return true;

  for (const [key, expected] of Object.entries(query)) {
    if (key === '$or') {
      const matchAny = expected.some((subQuery) => matchesQuery(doc, subQuery));
      if (!matchAny) return false;
      continue;
    }
    if (key === '$and') {
      const matchAll = expected.every((subQuery) => matchesQuery(doc, subQuery));
      if (!matchAll) return false;
      continue;
    }

    const actual = doc[key];
    const actualStr = actual != null ? String(actual) : actual;

    if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$in' in expected) {
        const allowed = expected.$in.map(String);
        if (!allowed.includes(actualStr)) return false;
        continue;
      }
      if ('$nin' in expected) {
        const disallowed = expected.$nin.map(String);
        if (disallowed.includes(actualStr)) return false;
        continue;
      }
      if ('$ne' in expected) {
        if (actualStr === String(expected.$ne)) return false;
        continue;
      }
      if ('$exists' in expected) {
        const exists = actual !== undefined;
        if (exists !== expected.$exists) return false;
        continue;
      }
      if ('$gte' in expected) {
        if (!(actual >= expected.$gte)) return false;
        continue;
      }
      if ('$gt' in expected) {
        if (!(actual > expected.$gt)) return false;
        continue;
      }
      if ('$lte' in expected) {
        if (!(actual <= expected.$lte)) return false;
        continue;
      }
      if ('$lt' in expected) {
        if (!(actual < expected.$lt)) return false;
        continue;
      }
      if ('$regex' in expected) {
        const regex = new RegExp(expected.$regex, expected.$options || '');
        if (!regex.test(String(actual || ''))) return false;
        continue;
      }
    }

    // Direct equality (handling ObjectId strings / primitives)
    if (String(actual) !== String(expected)) {
      return false;
    }
  }
  return true;
}

async function populateSingleDoc(doc, pathStr, db) {
  if (!doc) return;

  // Handle nested array path e.g. 'slots.subjectId'
  if (pathStr.includes('.')) {
    const [parentProp, childProp] = pathStr.split('.');
    if (Array.isArray(doc[parentProp])) {
      for (const item of doc[parentProp]) {
        await populateSingleDoc(item, childProp, db);
      }
    } else if (doc[parentProp] && typeof doc[parentProp] === 'object') {
      await populateSingleDoc(doc[parentProp], childProp, db);
    }
    return;
  }

  const field = pathStr;
  const targetCol = REF_COLLECTIONS[field];
  if (!targetCol) return;

  const currentVal = doc[field];
  if (!currentVal) return;

  // Case 1: Array of IDs (e.g. children: ['id1', 'id2'])
  if (Array.isArray(currentVal)) {
    const populatedArray = [];
    for (const item of currentVal) {
      const id = typeof item === 'object' ? (item._id || item.id) : item;
      if (id) {
        const snap = await db.collection(targetCol).doc(String(id)).get();
        if (snap.exists) {
          const itemData = snap.data();
          itemData._id = String(id);
          itemData.id = String(id);
          itemData.toString = () => String(id);
          // Nested populate for users if applicable
          if (itemData.userId && typeof itemData.userId === 'string') {
            const uSnap = await db.collection('users').doc(itemData.userId).get();
            if (uSnap.exists) itemData.userId = { ...uSnap.data(), _id: itemData.userId, id: itemData.userId, toString: () => itemData.userId };
          }
          populatedArray.push(itemData);
        }
      }
    }
    doc[field] = populatedArray;
    return;
  }

  // Case 2: Single ID string
  const docId = typeof currentVal === 'object' ? (currentVal._id || currentVal.id) : currentVal;
  if (!docId) return;

  const snap = await db.collection(targetCol).doc(String(docId)).get();
  if (snap.exists) {
    const refData = snap.data();
    refData._id = String(docId);
    refData.id = String(docId);
    refData.toString = () => String(docId);

    // Auto-populate userId if present in child profile (faculty, student, parent)
    if (refData.userId && typeof refData.userId === 'string') {
      const uSnap = await db.collection('users').doc(refData.userId).get();
      if (uSnap.exists) {
        refData.userId = { ...uSnap.data(), _id: refData.userId, id: refData.userId, toString: () => refData.userId };
      }
    }

    doc[field] = refData;
  }
}

class QueryCursor {
  constructor(model, query = {}, isSingle = false) {
    this.model = model;
    this.query = query;
    this.isSingle = isSingle;
    this._sort = null;
    this._limit = null;
    this._skip = null;
    this._populatePaths = [];
    this._isLean = false;
  }

  lean() {
    this._isLean = true;
    return this;
  }

  sort(sortObj) {
    this._sort = sortObj;
    return this;
  }

  limit(num) {
    this._limit = num;
    return this;
  }

  skip(num) {
    this._skip = num;
    return this;
  }

  select() {
    return this;
  }

  populate(paths) {
    if (typeof paths === 'string') {
      this._populatePaths.push(...paths.split(' ').filter(Boolean));
    } else if (Array.isArray(paths)) {
      paths.forEach((p) => this.populate(p));
    } else if (paths && typeof paths === 'object') {
      if (paths.path) this._populatePaths.push(paths.path);
      if (paths.populate) this.populate(paths.populate);
    }
    return this;
  }

  async exec() {
    const db = getDb();
    const colRef = db.collection(this.model.collectionName);

    // Apply tenant scoping if applicable
    const store = getTenantStore();
    const activeSchoolId = getCurrentSchoolId();
    const finalQuery = { ...this.query };
    if (this.model.hasTenant && store && !store.bypassTenant && activeSchoolId) {
      if (finalQuery.schoolId === undefined) {
        finalQuery.schoolId = String(activeSchoolId);
      }
    }

    // Fetch documents
    const snapshot = await colRef.get();
    let docs = [];
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      data._id = docSnap.id;
      data.id = docSnap.id;
      if (matchesQuery(data, finalQuery)) {
        docs.push(data);
      }
    });

    // Populate references if requested
    if (this._populatePaths.length > 0) {
      for (const doc of docs) {
        for (const p of this._populatePaths) {
          await populateSingleDoc(doc, p, db);
        }
      }
    }

    // Sort
    if (this._sort) {
      const sortEntries = Object.entries(this._sort);
      docs.sort((a, b) => {
        for (const [key, direction] of sortEntries) {
          const dir = direction === -1 || direction === 'desc' ? -1 : 1;
          const va = a[key];
          const vb = b[key];
          if (va < vb) return -1 * dir;
          if (va > vb) return 1 * dir;
        }
        return 0;
      });
    }

    if (this._skip) {
      docs = docs.slice(this._skip);
    }
    if (this._limit) {
      docs = docs.slice(0, this._limit);
    }

    // Wrap in model instance if not lean
    const results = docs.map((docData) => {
      const inst = this.model._wrap(docData);
      return this._isLean ? inst.toObject() : inst;
    });

    return this.isSingle ? (results[0] || null) : results;
  }

  then(onFulfilled, onRejected) {
    return this.exec().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.exec().catch(onRejected);
  }
}

export class FirestoreModel {
  constructor(collectionName, schema = {}, options = {}) {
    this.collectionName = collectionName;
    this.schema = schema;
    this.hasTenant = options.hasTenant ?? true;
  }

  _wrap(data) {
    if (!data) return null;
    const modelInstance = { ...data };
    const self = this;

    modelInstance._id = data._id || data.id;
    modelInstance.id = modelInstance._id;

    modelInstance.save = async function () {
      const db = getDb();
      const colRef = db.collection(self.collectionName);
      const docId = modelInstance._id || crypto.randomBytes(12).toString('hex');
      modelInstance._id = docId;
      modelInstance.id = docId;
      modelInstance.updatedAt = new Date().toISOString();
      await colRef.doc(docId).set(modelInstance, { merge: true });
      return modelInstance;
    };

    modelInstance.deleteOne = async function () {
      const db = getDb();
      const docId = String(modelInstance._id || modelInstance.id);
      await db.collection(self.collectionName).doc(docId).delete();
      return { acknowledged: true, deletedCount: 1 };
    };

    modelInstance.toObject = function () {
      const copy = { ...modelInstance };
      delete copy.toObject;
      delete copy.save;
      delete copy.deleteOne;
      delete copy.comparePassword;
      return copy;
    };

    // Password comparison helper for User
    if (modelInstance.passwordHash) {
      modelInstance.comparePassword = async function (password) {
        return bcrypt.compare(password, modelInstance.passwordHash);
      };
    }

    return modelInstance;
  }

  static async hashPassword(password) {
    return bcrypt.hash(password, 10);
  }

  find(query = {}) {
    return new QueryCursor(this, query, false);
  }

  findOne(query = {}) {
    return new QueryCursor(this, query, true);
  }

  findById(id) {
    if (!id) return new QueryCursor(this, { _id: '__non_existent__' }, true);
    return new QueryCursor(this, { _id: String(id) }, true);
  }

  async exists(query = {}) {
    const doc = await this.findOne(query).lean().exec();
    return doc ? { _id: doc._id } : null;
  }

  async distinct(field, query = {}) {
    const list = await this.find(query).lean().exec();
    const set = new Set();
    for (const doc of list) {
      if (doc[field] !== undefined) set.add(doc[field]);
    }
    return Array.from(set);
  }

  async countDocuments(query = {}) {
    const list = await this.find(query).lean().exec();
    return list.length;
  }

  async create(data) {
    const db = getDb();
    const colRef = db.collection(this.collectionName);

    const docId = data._id ? String(data._id) : (data.id ? String(data.id) : crypto.randomBytes(12).toString('hex'));
    const docData = {
      ...data,
      _id: docId,
      id: docId,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (this.collectionName === 'users' && docData.isActive === undefined) {
      docData.isActive = true;
    }

    const activeSchoolId = getCurrentSchoolId();
    if (this.hasTenant && activeSchoolId && !docData.schoolId && docData.role !== 'super_admin') {
      docData.schoolId = String(activeSchoolId);
    }

    await colRef.doc(docId).set(docData);
    return this._wrap(docData);
  }

  async insertMany(docs) {
    const created = [];
    for (const doc of docs) {
      created.push(await this.create(doc));
    }
    return created;
  }

  async findByIdAndUpdate(id, update, options = {}) {
    return this.findOneAndUpdate({ _id: String(id) }, update, options);
  }

  async findOneAndUpdate(query, update, options = {}) {
    const db = getDb();
    const colRef = db.collection(this.collectionName);

    const existing = await this.findOne(query).lean().exec();
    let targetId = existing ? existing._id : null;
    let baseData = existing || {};

    if (!existing) {
      if (!options.upsert) return null;
      targetId = query._id ? String(query._id) : crypto.randomBytes(12).toString('hex');
      baseData = { ...query, _id: targetId, id: targetId, createdAt: new Date().toISOString() };
    }

    // Process update operations
    const updated = { ...baseData };
    if (update.$set) {
      Object.assign(updated, update.$set);
    } else {
      for (const [k, v] of Object.entries(update)) {
        if (!k.startsWith('$')) {
          updated[k] = v;
        }
      }
    }

    if (update.$addToSet) {
      for (const [k, v] of Object.entries(update.$addToSet)) {
        const arr = Array.isArray(updated[k]) ? [...updated[k]] : [];
        const toAdd = Array.isArray(v) ? v : [v];
        toAdd.forEach((item) => {
          if (!arr.includes(item)) arr.push(item);
        });
        updated[k] = arr;
      }
    }

    if (update.$pull) {
      for (const [k, v] of Object.entries(update.$pull)) {
        if (Array.isArray(updated[k])) {
          updated[k] = updated[k].filter((item) => String(item) !== String(v));
        }
      }
    }

    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        updated[k] = (Number(updated[k]) || 0) + Number(v);
      }
    }

    updated._id = targetId;
    updated.id = targetId;
    updated.updatedAt = new Date().toISOString();

    await colRef.doc(targetId).set(updated, { merge: true });
    return this._wrap(updated);
  }

  async findByIdAndDelete(id) {
    const existing = await this.findById(id).lean().exec();
    if (!existing) return null;

    const db = getDb();
    await db.collection(this.collectionName).doc(String(id)).delete();
    return existing;
  }

  async deleteOne(query = {}) {
    const doc = await this.findOne(query).lean().exec();
    if (!doc) return { acknowledged: true, deletedCount: 0 };
    const db = getDb();
    await db.collection(this.collectionName).doc(String(doc._id)).delete();
    return { acknowledged: true, deletedCount: 1 };
  }

  async deleteMany(query = {}) {
    const matches = await this.find(query).lean().exec();
    const db = getDb();
    for (const doc of matches) {
      await db.collection(this.collectionName).doc(doc._id).delete();
    }
    return { deletedCount: matches.length };
  }

  async updateMany(query = {}, update = {}) {
    const matches = await this.find(query).lean().exec();
    for (const doc of matches) {
      await this.findByIdAndUpdate(doc._id, update);
    }
    return { modifiedCount: matches.length };
  }

  async bulkWrite(operations = []) {
    const results = [];
    for (const op of operations) {
      if (op.updateOne) {
        const { filter, update, upsert } = op.updateOne;
        const res = await this.findOneAndUpdate(filter, update, { upsert });
        results.push(res);
      } else if (op.insertOne) {
        const doc = op.insertOne.document || op.insertOne;
        const res = await this.create(doc);
        results.push(res);
      } else if (op.deleteOne) {
        const res = await this.deleteMany(op.deleteOne.filter);
        results.push(res);
      }
    }
    return { ok: 1, nModified: results.length, nUpserted: results.length };
  }

  async aggregate(pipeline = []) {
    let records = await this.find({}).lean().exec();

    for (const stage of pipeline) {
      if (stage.$match) {
        records = records.filter((doc) => matchesQuery(doc, stage.$match));
      }
      if (stage.$group) {
        const groupKeyField = stage.$group._id ? String(stage.$group._id).replace('$', '') : null;
        const groups = {};

        for (const doc of records) {
          const groupVal = groupKeyField ? String(doc[groupKeyField] || 'all') : 'all';
          if (!groups[groupVal]) {
            groups[groupVal] = { _id: groupVal };
            for (const [outKey, acc] of Object.entries(stage.$group)) {
              if (outKey === '_id') continue;
              groups[groupVal][outKey] = 0;
            }
          }

          for (const [outKey, acc] of Object.entries(stage.$group)) {
            if (outKey === '_id') continue;
            if (acc.$sum === 1) {
              groups[groupVal][outKey] += 1;
            } else if (acc.$sum && typeof acc.$sum === 'string') {
              const sumField = acc.$sum.replace('$', '');
              groups[groupVal][outKey] += Number(doc[sumField]) || 0;
            }
          }
        }
        records = Object.values(groups);
      }
    }
    return records;
  }

  async syncIndexes() {
    return true;
  }
}
