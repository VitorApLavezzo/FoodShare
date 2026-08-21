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
  cnpjApi: {
    url: process.env.CNPJ_API_URL ?? 'https://brasilapi.com.br/api/cnpj/v1',
    cacheTtlSeconds: parseInt(process.env.CNPJ_CACHE_TTL_SECONDS ?? '86400', 10),
  },
});
