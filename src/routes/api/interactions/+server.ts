import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from 'redis';

interface InteractionLog {
	id: string;
	action: string;
	timestamp: string;
	metadata?: Record<string, any>;
}

// Redis client initialization
const redisClient = createClient({
	url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Add logging helper
const logRedisAction = (action: string, key?: string, value?: any) => {
	console.log(`[REDIS] ${action}${key ? ` ${key}` : ''}${value ? ` ${JSON.stringify(value)}` : ''}`);
};

// Connect to Redis
redisClient.on('error', (err) => {
	console.error('Redis Client Error', err);
});
redisClient.on('connect', () => {
	console.log('Redis Client Connected');
});
redisClient.on('ready', () => {
	console.log('Redis Client Ready');
});
redisClient.connect().catch(console.error);

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action, metadata } = await request.json();
		
		const interaction: InteractionLog = {
			id: crypto.randomUUID(),
			action,
			timestamp: new Date().toISOString(),
			metadata
		};
		
		// Store interaction in Redis
		logRedisAction('LPUSH', 'interactions', interaction);
		await redisClient.lPush('interactions', JSON.stringify(interaction));
		
		// Trim the list to keep only the last 1000 interactions
		logRedisAction('LTRIM', 'interactions', [0, 999]);
		await redisClient.lTrim('interactions', 0, 999);
		
		// Get the current length
		logRedisAction('LLEN', 'interactions');
		const totalInteractions = await redisClient.lLen('interactions');
		
		logRedisAction('INTERACTION_RECORDED', 'interactions', { action, totalInteractions });
		
		return json({
			success: true,
			interaction,
			totalInteractions
		});
		
	} catch (error) {
		console.error('[REDIS] Error in POST handler:', error);
		return json({ 
			error: 'Failed to log interaction',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ url }) => {
	const limit = Number(url.searchParams.get('limit')) || 50;
	const action = url.searchParams.get('action');
	
	// Get all interactions from Redis
	logRedisAction('LRANGE', 'interactions', [0, -1]);
	const interactionStrings = await redisClient.lRange('interactions', 0, -1);
	let interactions = interactionStrings.map(i => {
		try {
			return JSON.parse(i);
		} catch (e) {
			console.error('[REDIS] Error parsing interaction data:', e);
			return null;
		}
	}).filter(i => i !== null);
	
	if (action) {
		interactions = interactions.filter(i => i.action === action);
	}
	
	const recentInteractions = interactions
		.slice(0, limit)
		.reverse();
	
	logRedisAction('LLEN', 'interactions');
	const totalInteractions = await redisClient.lLen('interactions');
	const uniqueActions = [...new Set(interactions.map(i => i.action))];
	const lastHour = interactions.filter(i => 
		new Date(i.timestamp) > new Date(Date.now() - 60 * 60 * 1000)
	).length;
	
	const stats = {
		total: totalInteractions,
		filtered: interactions.length,
		actions: uniqueActions,
		lastHour
	};
	
	logRedisAction('INTERACTIONS_RETRIEVED', 'interactions', { 
		total: totalInteractions, 
		filtered: interactions.length, 
		limit 
	});
	
	return json({
		interactions: recentInteractions,
		stats
	});
};