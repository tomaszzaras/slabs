import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import { handle } from '../lib/projects-api';

export default async (req: Request): Promise<Response> => handle(req, getStore({ name: 'projects', consistency: 'strong' }) as never);

export const config: Config = { path: ['/api/projects', '/api/projects/*'] };
