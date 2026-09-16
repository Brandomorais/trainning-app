import { handleRequest } from './service.js';

Deno.serve((request: Request) => handleRequest(request, {
  supabaseUrl: Deno.env.get('SUPABASE_URL'),
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  openaiKey: Deno.env.get('OPENAI_API_KEY'),
  model: Deno.env.get('OPENAI_MODEL'),
  origin: Deno.env.get('APP_ORIGIN'),
  allowedUser: Deno.env.get('COACH_USER_ID'),
  cronSecret: Deno.env.get('COACH_CRON_SECRET'),
  dailyLimit: Number(Deno.env.get('COACH_DAILY_LIMIT') ?? 40),
}));
