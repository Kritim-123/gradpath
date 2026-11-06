import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { handleApi } from '../../../lib/gradpath-api.mjs';
export const dynamic = 'force-dynamic';
async function dispatch(request: Request) {
  return handleApi(request, {db: env.DB, user: await getChatGPTUser()});
}
export const GET = dispatch;
export const POST = dispatch;
