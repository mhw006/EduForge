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
