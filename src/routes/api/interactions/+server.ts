import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface InteractionLog {
	id: string;
	action: string;
	timestamp: string;
	metadata?: Record<string, any>;
}

let interactions: InteractionLog[] = [];

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action, metadata } = await request.json();
		
		const interaction: InteractionLog = {
			id: crypto.randomUUID(),
			action,
			timestamp: new Date().toISOString(),
			metadata
		};
		
		interactions.push(interaction);
		
		if (interactions.length > 1000) {
			interactions = interactions.slice(-1000);
		}
		
		return json({
			success: true,
			interaction,
			totalInteractions: interactions.length
		});
		
	} catch (error) {
		return json({ 
			error: 'Failed to log interaction',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ url }) => {
	const limit = Number(url.searchParams.get('limit')) || 50;
	const action = url.searchParams.get('action');
	
	let filteredInteractions = interactions;
	
	if (action) {
		filteredInteractions = interactions.filter(i => i.action === action);
	}
	
	const recentInteractions = filteredInteractions
		.slice(-limit)
		.reverse();
	
	const stats = {
		total: interactions.length,
		filtered: filteredInteractions.length,
		actions: [...new Set(interactions.map(i => i.action))],
		lastHour: interactions.filter(i => 
			new Date(i.timestamp) > new Date(Date.now() - 60 * 60 * 1000)
		).length
	};
	
	return json({
		interactions: recentInteractions,
		stats
	});
};