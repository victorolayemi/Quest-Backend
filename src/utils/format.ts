export function formatDates(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => formatDates(item));
  }
  
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if ((key === 'createdAt' || key === 'updatedAt' || key === 'expiresAt' || key === 'mediaRestrictionExpiry' || key === 'time') && obj[key]) {
          const val = obj[key];
          if (typeof val === 'number' || typeof val === 'string') {
            try {
              newObj[key] = new Date(val).toISOString();
            } catch (e) {
              newObj[key] = val;
            }
          } else if (val instanceof Date) {
            newObj[key] = val.toISOString();
          } else {
            newObj[key] = val;
          }
        } else {
          newObj[key] = formatDates(obj[key]);
        }
      }
    }
    return newObj;
  }
  
  return obj;
}
