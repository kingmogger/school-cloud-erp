import mongoose from 'mongoose';
import { getCurrentSchoolId, getTenantStore } from '../../utils/tenantContext.js';

export function tenantPlugin(schema, options = {}) {
  const { required = true } = options;

  if (!schema.path('schoolId')) {
    schema.add({
      schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: required ? function isSchoolRequired() { return this.role !== 'super_admin'; } : false,
        index: true,
        default: null,
      },
    });
  }

  // Auto-populate schoolId on validate/save from active tenant context
  schema.pre('validate', function assignTenantOnValidate(next) {
    const schoolId = getCurrentSchoolId();
    if (schoolId && !this.schoolId && this.role !== 'super_admin') {
      this.schoolId = schoolId;
    }
    next();
  });

  schema.pre('insertMany', function assignTenantOnInsertMany(next, docs) {
    const schoolId = getCurrentSchoolId();
    if (schoolId && Array.isArray(docs)) {
      for (const doc of docs) {
        if (!doc.schoolId && doc.role !== 'super_admin') {
          doc.schoolId = schoolId;
        }
      }
    }
    next();
  });

  const queryHooks = [
    'find',
    'findOne',
    'countDocuments',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'findOneAndUpdate',
    'findOneAndDelete',
    'exists',
  ];

  for (const hook of queryHooks) {
    schema.pre(hook, function injectTenantFilter(next) {
      const store = getTenantStore();
      if (!store || store.bypassTenant) {
        return next();
      }
      if (store.schoolId) {
        const filter = this.getFilter();
        if (filter.schoolId === undefined) {
          this.where({ schoolId: store.schoolId });
        }
      }
      return next();
    });
  }

  schema.pre('aggregate', function injectTenantAggregate(next) {
    const store = getTenantStore();
    if (!store || store.bypassTenant || !store.schoolId) {
      return next();
    }
    const pipeline = this.pipeline();
    const first = pipeline[0];
    if (!first || !first.$match || first.$match.schoolId === undefined) {
      pipeline.unshift({ $match: { schoolId: new mongoose.Types.ObjectId(store.schoolId) } });
    }
    return next();
  });
}
