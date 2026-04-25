<<<<<<< HEAD
import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
    directUrl: process.env.DIRECT_URL!,
  },
});
=======
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DIRECT_URL'),
  },
  migrate: {
    path: 'prisma/migrations',
  },
})
>>>>>>> a25a3ac (feat: complete backend - DB, routes, adaptation middleware, analytics, PDF export)
