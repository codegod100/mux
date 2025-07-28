import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

let analyticsStore: Record<string, any> = {
	sessions: [],
	events: [],
	performance: []
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const timestamp = new Date().toISOString();
		
		switch (data.type) {
			case 'pageview':
				analyticsStore.sessions.push({
					...data,
					timestamp,
					id: crypto.randomUUID()
				});
				break;
				
			case 'event':
				analyticsStore.events.push({
					...data,
					timestamp,
					id: crypto.randomUUID()
				});
				break;
				
			case 'performance':
				analyticsStore.performance.push({
					...data,
					timestamp,
					id: crypto.randomUUID()
				});
				break;
		}
		
		return json({ success: true, recorded: timestamp });
		
	} catch (error) {
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
	
	const recentSessions = analyticsStore.sessions.filter(s => 
		new Date(s.timestamp) > timeFilter
	);
	
	const recentEvents = analyticsStore.events.filter(e => 
		new Date(e.timestamp) > timeFilter
	);
	
	const recentPerformance = analyticsStore.performance.filter(p => 
		new Date(p.timestamp) > timeFilter
	);
	
	const analytics: AnalyticsData = {
		metrics: {
			pageViews: recentSessions.length,
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