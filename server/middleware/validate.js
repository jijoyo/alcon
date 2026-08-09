export function requireString(value, fieldName) {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    return { error: `${fieldName} is required` };
  }
  return null;
}

export function requireNumber(value, fieldName) {
  if (value === undefined || value === null || typeof value !== 'number') {
    return { error: `${fieldName} is required` };
  }
  return null;
}

export function maxLength(value, max, fieldName) {
  if (value && typeof value === 'string' && value.length > max) {
    return { error: `${fieldName} must be max ${max} characters` };
  }
  return null;
}

export function validateBody(rules) {
  return async (request, reply) => {
    const body = request.body || {};
    for (const rule of rules) {
      const err = rule(body);
      if (err) return reply.code(400).send(err);
    }
  };
}
