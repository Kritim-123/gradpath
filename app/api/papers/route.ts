import { env } from 'cloudflare:workers';
import { handlePaperSearch } from '../../../lib/papers-api.mjs';
export const dynamic = 'force-dynamic';
function dispatch(request: Request) {
  return handlePaperSearch(request, {db: env.DB, apiKey: env.OPENALEX_API_KEY});
}
export const GET = dispatch;
export const OPTIONS = dispatch;
