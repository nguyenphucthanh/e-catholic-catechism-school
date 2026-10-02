import { defineApp } from 'convex/server'
import { v } from 'convex/values'

const app = defineApp({
  env: {
    RECAPTCHA_SECRET_KEY: v.optional(v.string()),
    BREAK_GLASS_CODE: v.optional(v.string()),
    DEMO_APP: v.optional(v.string()),
    CATECHIST_ACCOUNT_PREFIX: v.optional(v.string()),
    STUDENT_ACCOUNT_PREFIX: v.optional(v.string()),
  },
})

export default app
