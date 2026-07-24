import crypto from 'node:crypto';

export default function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const requestId = String(req.get('x-request-id') || crypto.randomUUID()).slice(0, 80);
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const record = {
      type: 'http_request',
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
      userId: req.user?.id || null,
      ip: req.ip || req.socket?.remoteAddress || null,
      userAgent: String(req.get('user-agent') || '').slice(0, 200)
    };
    const serialized = JSON.stringify(record);
    if (res.statusCode >= 500) console.error(serialized);
    else if (res.statusCode >= 400) console.warn(serialized);
    else if (process.env.LOG_HTTP_SUCCESS === 'true') console.log(serialized);
  });
  next();
}

