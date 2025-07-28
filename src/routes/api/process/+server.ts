import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface ProcessRequest {
	data: any;
	type: 'calculation' | 'transformation' | 'validation';
	options?: Record<string, any>;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body: ProcessRequest = await request.json();
		
		let result;
		
		switch (body.type) {
			case 'calculation':
				result = processCalculation(body.data, body.options);
				break;
			case 'transformation':
				result = processTransformation(body.data, body.options);
				break;
			case 'validation':
				result = processValidation(body.data, body.options);
				break;
			default:
				return json({ error: 'Unknown processing type' }, { status: 400 });
		}
		
		return json({
			success: true,
			result,
			processedAt: new Date().toISOString(),
			type: body.type
		});
		
	} catch (error) {
		return json({ 
			error: 'Processing failed', 
			details: error instanceof Error ? error.message : 'Unknown error' 
		}, { status: 500 });
	}
};

function processCalculation(data: any, options?: Record<string, any>) {
	if (Array.isArray(data) && data.every(n => typeof n === 'number')) {
		const sum = data.reduce((a, b) => a + b, 0);
		const avg = sum / data.length;
		const max = Math.max(...data);
		const min = Math.min(...data);
		
		return {
			sum,
			average: avg,
			maximum: max,
			minimum: min,
			count: data.length
		};
	}
	
	return { error: 'Invalid data for calculation' };
}

function processTransformation(data: any, options?: Record<string, any>) {
	const transformType = options?.transform || 'uppercase';
	
	if (typeof data === 'string') {
		switch (transformType) {
			case 'uppercase':
				return data.toUpperCase();
			case 'lowercase':
				return data.toLowerCase();
			case 'reverse':
				return data.split('').reverse().join('');
			case 'wordcount':
				return { words: data.split(/\s+/).length, characters: data.length };
			default:
				return data;
		}
	}
	
	if (Array.isArray(data)) {
		switch (transformType) {
			case 'sort':
				return [...data].sort();
			case 'reverse':
				return [...data].reverse();
			case 'unique':
				return [...new Set(data)];
			default:
				return data;
		}
	}
	
	return data;
}

function processValidation(data: any, options?: Record<string, any>) {
	const rules = options?.rules || {};
	const errors: string[] = [];
	
	if (rules.required && (!data || data === '')) {
		errors.push('Field is required');
	}
	
	if (rules.minLength && typeof data === 'string' && data.length < rules.minLength) {
		errors.push(`Minimum length is ${rules.minLength}`);
	}
	
	if (rules.maxLength && typeof data === 'string' && data.length > rules.maxLength) {
		errors.push(`Maximum length is ${rules.maxLength}`);
	}
	
	if (rules.pattern && typeof data === 'string' && !new RegExp(rules.pattern).test(data)) {
		errors.push('Pattern validation failed');
	}
	
	if (rules.type === 'email' && typeof data === 'string') {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(data)) {
			errors.push('Invalid email format');
		}
	}
	
	return {
		valid: errors.length === 0,
		errors,
		value: data
	};
}