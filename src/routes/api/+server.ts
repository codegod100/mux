import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({
		message: 'API is running',
		timestamp: new Date().toISOString(),
		version: '1.0.0'
	});
};