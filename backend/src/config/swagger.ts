import { env } from './env';

/**
 * Static OpenAPI 3.0 spec (served at API_DOCS_PATH). Kept in one place so the
 * docs always match the routes defined in src/routes.
 */
export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Spot the Phish API',
    version: '1.0.0',
    description: 'Full-stack backend for the Spot the Phish cyber-security training game. Persists players, game sessions, per-stimulus attempts, final reports and aggregate analytics.',
  },
  servers: [
    { url: `http://localhost:${env.PORT}/api`, description: 'Local / Docker (host)' },
  ],
  tags: [
    { name: 'Players', description: 'Player profile management' },
    { name: 'Sessions', description: 'Game lifecycle and progress' },
    { name: 'Results', description: 'Final reports and downloadable metadata' },
    { name: 'Analytics', description: 'Aggregate analytics and leaderboard' },
  ],
  components: {
    securitySchemes: {},
    schemas: {
      Player: {
        type: 'object',
        required: ['playerId', 'name'],
        properties: {
          playerId: { type: 'string', example: 'p_8f3b...uuid' },
          name: { type: 'string', example: 'Neo' },
        },
      },
      PlayerName: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
      StartSession: {
        type: 'object',
        required: ['sessionId', 'playerId'],
        properties: { sessionId: { type: 'string' }, playerId: { type: 'string' } },
      },
      Attempt: {
        type: 'object',
        required: ['stimulusId', 'category', 'tier'],
        properties: {
          stimulusId: { type: 'string', example: 'g1' },
          category: { type: 'string', example: 'E-commerce / Orders' },
          tier: { type: 'integer', minimum: 1, maximum: 5 },
          playerChoice: { type: 'string' },
          correctAnswer: { type: 'object' },
          investigations: { type: 'object' },
          isCorrect: { type: 'boolean', default: false },
          scoreAwarded: { type: 'integer', minimum: 0, default: 0 },
          responseTimeMs: { type: 'integer', minimum: 0 },
        },
      },
      Progress: {
        type: 'object',
        properties: {
          totalScore: { type: 'integer', minimum: 0 },
          completedLevels: { type: 'integer', minimum: 0, maximum: 5 },
          livesRemaining: { type: 'integer', minimum: 0, maximum: 3 },
          streakAchieved: { type: 'integer', minimum: 0 },
          stimuliAttempted: { type: 'integer', minimum: 0 },
        },
      },
      Finish: {
        type: 'object',
        required: ['totalScore', 'completedLevels', 'livesRemaining', 'streakAchieved'],
        allOf: [
          { $ref: '#/components/schemas/Progress' },
          {
            type: 'object',
            properties: {
              designation: { type: 'string' },
              readinessLevel: { type: 'string', enum: ['LOW', 'MODERATE', 'HIGH', 'ELITE'] },
              reportSummary: { type: 'string' },
            },
          },
        ],
      },
      Report: {
        type: 'object',
        properties: {
          compositeScore: { type: 'number' },
          designation: { type: 'string' },
          readinessLevel: { type: 'string', enum: ['LOW', 'MODERATE', 'HIGH', 'ELITE'] },
          strongestCategory: { type: 'string' },
          weakestCategory: { type: 'string' },
          categoryAccuracy: { type: 'object', additionalProperties: { type: 'number' } },
          tierAccuracy: { type: 'object', additionalProperties: { type: 'number' } },
          phishingDetectionRate: { type: 'number' },
          falseAlarmRate: { type: 'number' },
          reportSummary: { type: 'string' },
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses: { type: 'array', items: { type: 'string' } },
          readinessSummary: { type: 'string' },
        },
      },
      Error: {
        type: 'object',
        properties: { success: { type: 'boolean', example: false }, message: { type: 'string' } },
      },
    },
  },
  paths: {
    '/players': {
      post: {
        tags: ['Players'],
        summary: 'Create or update a player (idempotent)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Player' } } } },
        responses: { '201': { description: 'Created/updated' }, '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } },
      },
    },
    '/players/{playerId}': {
      get: { tags: ['Players'], summary: 'Get a player', parameters: [inPath('playerId')], responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } } },
      patch: { tags: ['Players'], summary: 'Update player name', parameters: [inPath('playerId')], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PlayerName' } } } }, responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } } },
    },
    '/sessions/start': {
      post: { tags: ['Sessions'], summary: 'Start a game session', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/StartSession' } } } }, responses: { '201': { description: 'Started' } } },
    },
    '/sessions': {
      get: { tags: ['Sessions'], summary: 'List previous sessions', parameters: [{ in: 'query', name: 'playerId', required: true, schema: { type: 'string' } }, { in: 'query', name: 'limit', schema: { type: 'integer' } }], responses: { '200': { description: 'OK' } } },
    },
    '/sessions/{sessionId}': {
      get: { tags: ['Sessions'], summary: 'Get a session', parameters: [inPath('sessionId')], responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } } },
    },
    '/sessions/{sessionId}/attempts': {
      post: { tags: ['Sessions'], summary: 'Record a completed stimulus', parameters: [inPath('sessionId')], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Attempt' } } } }, responses: { '201': { description: 'Recorded' } } },
    },
    '/sessions/{sessionId}/progress': {
      patch: { tags: ['Sessions'], summary: 'Save in-progress state', parameters: [inPath('sessionId')], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Progress' } } } }, responses: { '200': { description: 'Saved' } } },
    },
    '/sessions/{sessionId}/finish': {
      post: { tags: ['Sessions'], summary: 'Finish the game', parameters: [inPath('sessionId')], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Finish' } } } }, responses: { '200': { description: 'Finished' } } },
    },
    '/sessions/{sessionId}/report': {
      post: { tags: ['Results'], summary: 'Save final report + analytics', parameters: [inPath('sessionId')], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Report' } } } }, responses: { '201': { description: 'Saved' } } },
      get: { tags: ['Results'], summary: 'Fetch report', parameters: [inPath('sessionId')], responses: { '200': { description: 'OK' } } },
    },
    '/sessions/{sessionId}/report/download': {
      get: { tags: ['Results'], summary: 'Downloadable report metadata', parameters: [inPath('sessionId')], responses: { '200': { description: 'OK' } } },
    },
    '/analytics/overall': { get: { tags: ['Analytics'], summary: 'Overall rollup', responses: { '200': { description: 'OK' } } } },
    '/analytics/categories': { get: { tags: ['Analytics'], summary: 'Per-category accuracy', responses: { '200': { description: 'OK' } } } },
    '/analytics/tiers': { get: { tags: ['Analytics'], summary: 'Per-tier accuracy', responses: { '200': { description: 'OK' } } } },
    '/analytics/leaderboard': { get: { tags: ['Analytics'], summary: 'Top scores', parameters: [{ in: 'query', name: 'limit', schema: { type: 'integer' } }], responses: { '200': { description: 'OK' } } } },
  },
};

function inPath(name: string) {
  return { in: 'path', name, required: true, schema: { type: 'string' } };
}
