import { AsyncLocalStorage } from 'node:async_hooks';

export const tenantStorage = new AsyncLocalStorage();

export function getTenantStore() {
  return tenantStorage.getStore() || null;
}

export function getCurrentSchoolId() {
  const store = getTenantStore();
  return store && !store.bypassTenant ? store.schoolId || null : null;
}

export function runWithTenant(schoolId, fn) {
  return tenantStorage.run({ schoolId: schoolId ? String(schoolId) : null, bypassTenant: false }, fn);
}

export function runWithoutTenant(fn) {
  return tenantStorage.run({ schoolId: null, bypassTenant: true }, fn);
}
