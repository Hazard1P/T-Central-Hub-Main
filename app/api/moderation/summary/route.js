import { GET as adminQueue } from '../../admin/moderation/route';
export const dynamic = 'force-dynamic';
// Legacy URL shares the dashboard's private, administrator-only authorization.
export async function GET(request) { return adminQueue(request); }
