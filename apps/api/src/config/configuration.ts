export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  node: {
    id: process.env.NODE_ID ?? 'LIMEIRA',
    name: process.env.NODE_NAME ?? 'Node Limeira',
    city: process.env.NODE_CITY ?? 'Limeira',
    state: process.env.NODE_STATE ?? 'SP',
  },
  notifications: {
    radiusKm: parseInt(process.env.NOTIFICATION_RADIUS_KM ?? '50', 10),
  },
  mail: {
    // Sem MAIL_HOST o serviço cai no modo log — desenvolvimento não precisa de SMTP.
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT ?? '587', 10),
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM ?? 'FoodShare <nao-responda@foodshare.local>',
  },
  webAppUrl: process.env.WEB_APP_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  uploads: {
    dir: process.env.UPLOADS_DIR ?? 'uploads',
    maxFileSizeBytes: parseInt(process.env.UPLOADS_MAX_BYTES ?? '5242880', 10),
  },
  retention: {
    auditLogDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS ?? '180', 10),
    syncEventDays: parseInt(process.env.SYNC_EVENT_RETENTION_DAYS ?? '30', 10),
  },
  reservations: {
    // Tolerância após o prazo de retirada antes de liberar a reserva abandonada.
    pickupGraceMinutes: parseInt(process.env.RESERVATION_PICKUP_GRACE_MINUTES ?? '120', 10),
  },
  cnpjApi: {
    url: process.env.CNPJ_API_URL ?? 'https://brasilapi.com.br/api/cnpj/v1',
    cacheTtlSeconds: parseInt(process.env.CNPJ_CACHE_TTL_SECONDS ?? '86400', 10),
    timeoutMs: parseInt(process.env.CNPJ_TIMEOUT_MS ?? '8000', 10),
  },
});
