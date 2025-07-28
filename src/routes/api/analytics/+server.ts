import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from 'redis';

interface AnalyticsData {
	metrics: {
		pageViews: number;
		uniqueVisitors: number;
		averageSessionTime: number;
		bounceRate: number;
	};
	performance: {
		loadTime: number;
		renderTime: number;
		interactionDelay: number;
	};
	userBehavior: {
		topActions: Array<{ action: string; count: number }>;
		conversionRate: number;
		retentionRate: number;
	};
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

// Initialize counters if they don't exist
async function initializeCounters() {
	logRedisAction('CHECK_EXISTS', 'analytics:pageViews');
	const exists = await redisClient.exists('analytics:pageViews');
	if (!exists) {
		logRedisAction('SET', 'analytics:pageViews', 0);
		await redisClient.set('analytics:pageViews', 0);
		logRedisAction('SET', 'analytics:uniqueVisitors', 0);
		await redisClient.set('analytics:uniqueVisitors', 0);
	}
}

initializeCounters().catch(console.error);

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const timestamp = new Date().toISOString();
		
		switch (data.type) {
			case 'pageview':
				// Increment page views counter
				logRedisAction('INCR', 'analytics:pageViews');
				await redisClient.incr('analytics:pageViews');
				
				// Store session data
				const sessionId = data.sessionId || crypto.randomUUID();
				logRedisAction('LPUSH', 'analytics:sessions', { ...data, timestamp, id: sessionId });
				await redisClient.lPush('analytics:sessions', JSON.stringify({
					...data,
					timestamp,
					id: sessionId
				}));
				
				// Trim the list to keep only the last 1000 sessions
				logRedisAction('LTRIM', 'analytics:sessions', [0, 999]);
				await redisClient.lTrim('analytics:sessions', 0, 999);
				break;
				
			case 'event':
				// Store event data
				logRedisAction('LPUSH', 'analytics:events', { ...data, timestamp, id: crypto.randomUUID() });
				await redisClient.lPush('analytics:events', JSON.stringify({
					...data,
					timestamp,
					id: crypto.randomUUID()
				}));
				
				// Trim the list to keep only the last 10000 events
				logRedisAction('LTRIM', 'analytics:events', [0, 9999]);
				await redisClient.lTrim('analytics:events', 0, 9999);
				break;
				
			case 'performance':
				// Store performance data
				logRedisAction('LPUSH', 'analytics:performance', { ...data, timestamp, id: crypto.randomUUID() });
				await redisClient.lPush('analytics:performance', JSON.stringify({
					...data,
					timestamp,
					id: crypto.randomUUID()
				}));
				
				// Trim the list to keep only the last 1000 performance records
				logRedisAction('LTRIM', 'analytics:performance', [0, 999]);
				await redisClient.lTrim('analytics:performance', 0, 999);
				break;
		}
		
		return json({ success: true, recorded: timestamp });
		
	} catch (error) {
		console.error('[REDIS] Error in POST handler:', error);
		return json({ 
			error: 'Failed to record analytics',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ url }) => {
	const timeframe = url.searchParams.get('timeframe') || '24h';
	const now = new Date();
	
	let timeFilter: Date;
	switch (timeframe) {
		case '1h':
			timeFilter = new Date(now.getTime() - 60 * 60 * 1000);
			break;
		case '24h':
			timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
			break;
		case '7d':
			timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
			break;
		default:
			timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	}
	
	// Get page views from Redis
	logRedisAction('GET', 'analytics:pageViews');
	const pageViews = await redisClient.get('analytics:pageViews') || '0';
	
	// Get sessions from Redis
	logRedisAction('LRANGE', 'analytics:sessions', [0, -1]);
	const sessionStrings = await redisClient.lRange('analytics:sessions', 0, -1);
	const recentSessions = sessionStrings
		.map(s => {
			try {
				return JSON.parse(s);
			} catch (e) {
				console.error('[REDIS] Error parsing session data:', e);
				return null;
			}
		})
		.filter(s => s && new Date(s.timestamp) > timeFilter);
	
	// Get events from Redis
	logRedisAction('LRANGE', 'analytics:events', [0, -1]);
	const eventStrings = await redisClient.lRange('analytics:events', 0, -1);
	const recentEvents = eventStrings
		.map(e => {
			try {
				return JSON.parse(e);
			} catch (e) {
				console.error('[REDIS] Error parsing event data:', e);
				return null;
			}
		})
		.filter(e => e && new Date(e.timestamp) > timeFilter);
	
	// Get performance data from Redis
	logRedisAction('LRANGE', 'analytics:performance', [0, -1]);
	const performanceStrings = await redisClient.lRange('analytics:performance', 0, -1);
	const recentPerformance = performanceStrings
		.map(p => {
			try {
				return JSON.parse(p);
			} catch (e) {
				console.error('[REDIS] Error parsing performance data:', e);
				return null;
			}
		})
		.filter(p => p && new Date(p.timestamp) > timeFilter);
	
	const analytics: AnalyticsData = {
		metrics: {
			pageViews: parseInt(pageViews),
			uniqueVisitors: new Set(recentSessions.map(s => s.userId || s.sessionId)).size,
			averageSessionTime: calculateAverageSessionTime(recentSessions),
			bounceRate: calculateBounceRate(recentSessions, recentEvents)
		},
		performance: {
			loadTime: calculateAverage(recentPerformance, 'loadTime'),
			renderTime: calculateAverage(recentPerformance, 'renderTime'),
			interactionDelay: calculateAverage(recentPerformance, 'interactionDelay')
		},
		userBehavior: {
			topActions: getTopActions(recentEvents),
			conversionRate: calculateConversionRate(recentSessions, recentEvents),
			retentionRate: calculateRetentionRate(recentSessions)
		}
	};
	
	logRedisAction('GET_COMPLETE', 'analytics', {
		pageViews: parseInt(pageViews),
		sessions: recentSessions.length,
		events: recentEvents.length,
		performance: recentPerformance.length
	});
	
	return json({
		analytics,
		timeframe,
		dataPoints: {
			sessions: recentSessions.length,
			events: recentEvents.length,
			performance: recentPerformance.length
		}
	});
};

// Add a new endpoint for page view tracking
export const PUT: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		
		// Increment page views counter
		logRedisAction('INCR', 'analytics:pageViews');
		const pageViews = await redisClient.incr('analytics:pageViews');
		
		// Store session data
		const sessionId = data.sessionId || crypto.randomUUID();
		logRedisAction('LPUSH', 'analytics:sessions', { ...data, timestamp: new Date().toISOString(), id: sessionId });
		await redisClient.lPush('analytics:sessions', JSON.stringify({
			...data,
			timestamp: new Date().toISOString(),
			id: sessionId
		}));
		
		// Trim the list to keep only the last 1000 sessions
		logRedisAction('LTRIM', 'analytics:sessions', [0, 999]);
		await redisClient.lTrim('analytics:sessions', 0, 999);
		
		logRedisAction('PAGE_VIEW_RECORDED', 'analytics', { pageViews, sessionId });
		
		return json({ 
			success: true, 
			pageViews,
			message: 'Page view recorded'
		});
		
	} catch (error) {
		console.error('[REDIS] Error in PUT handler:', error);
		return json({ 
			error: 'Failed to record page view',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};

function calculateAverageSessionTime(sessions: any[]): number {
	if (sessions.length === 0) return 0;
	const times = sessions.map(s => s.sessionTime || 0).filter(t => t > 0);
	return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
}

function calculateBounceRate(sessions: any[], events: any[]): number {
	if (sessions.length === 0) return 0;
	const sessionsWithEvents = new Set(events.map(e => e.sessionId));
	const bouncedSessions = sessions.filter(s => !sessionsWithEvents.has(s.id));
	return (bouncedSessions.length / sessions.length) * 100;
}

function calculateAverage(items: any[], field: string): number {
	if (items.length === 0) return 0;
	const values = items.map(item => item[field]).filter(v => typeof v === 'number');
	return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function getTopActions(events: any[]): Array<{ action: string; count: number }> {
	const actionCounts: Record<string, number> = {};
	events.forEach(event => {
		const action = event.action || 'unknown';
		actionCounts[action] = (actionCounts[action] || 0) + 1;
	});
	
	return Object.entries(actionCounts)
		.map(([action, count]) => ({ action, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);
}

function calculateConversionRate(sessions: any[], events: any[]): number {
	if (sessions.length === 0) return 0;
	const conversions = events.filter(e => e.action === 'conversion' || e.action === 'get_started');
	const uniqueConversions = new Set(conversions.map(e => e.sessionId));
	return (uniqueConversions.size / sessions.length) * 100;
}

function calculateRetentionRate(sessions: any[]): number {
	const uniqueUsers = new Set(sessions.map(s => s.userId).filter(Boolean));
	const returningUsers = sessions.filter(s => s.isReturning);
	const uniqueReturningUsers = new Set(returningUsers.map(s => s.userId).filter(Boolean));
	
	if (uniqueUsers.size === 0) return 0;
	return (uniqueReturningUsers.size / uniqueUsers.size) * 100;
}