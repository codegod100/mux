<script>
	let currentView = $state('welcome');
	let clickCount = $state(0);
	let selectedFeature = $state(null);
	let showNotification = $state(false);
	let apiResults = $state({});
	let processingData = $state('');
	let processingType = $state('calculation');
	let analyticsData = $state(null);
	let interactions = $state([]);

	async function logInteraction(action, metadata) {
		try {
			await fetch('/api/interactions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, metadata })
			});
		} catch (error) {
			console.error('Failed to log interaction:', error);
		}
	}

	async function handleGetStarted() {
		currentView = 'dashboard';
		clickCount++;
		showNotification = true;
		setTimeout(() => showNotification = false, 3000);
		
		await logInteraction('get_started', { 
			previousView: 'welcome',
			clickCount 
		});
	}

	async function handleLearnMore() {
		currentView = 'features';
		clickCount++;
		
		await logInteraction('learn_more', { 
			previousView: 'welcome',
			clickCount 
		});
	}

	async function selectFeature(feature) {
		selectedFeature = selectedFeature === feature ? null : feature;
		
		await logInteraction('feature_select', { 
			feature,
			selected: selectedFeature === feature,
			clickCount 
		});
	}

	async function goBack() {
		const previousView = currentView;
		currentView = 'welcome';
		selectedFeature = null;
		
		await logInteraction('navigate_back', { 
			fromView: previousView,
			clickCount 
		});
	}

	async function testApiEndpoint(endpoint) {
		try {
			const response = await fetch(`/api${endpoint}`);
			const data = await response.json();
			apiResults[endpoint] = data;
			apiResults = { ...apiResults };
		} catch (error) {
			apiResults[endpoint] = { error: error.message };
			apiResults = { ...apiResults };
		}
	}

	async function processData() {
		if (!processingData.trim()) return;
		
		try {
			let data;
			try {
				data = JSON.parse(processingData);
			} catch {
				data = processingData;
			}
			
			const response = await fetch('/api/process', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					data,
					type: processingType,
					options: processingType === 'transformation' ? { transform: 'uppercase' } : {}
				})
			});
			
			const result = await response.json();
			apiResults.process = result;
			apiResults = { ...apiResults };
		} catch (error) {
			apiResults.process = { error: error.message };
			apiResults = { ...apiResults };
		}
	}

	async function loadAnalytics() {
		try {
			const response = await fetch('/api/analytics');
			analyticsData = await response.json();
		} catch (error) {
			analyticsData = { error: error.message };
		}
	}

	async function loadInteractions() {
		try {
			const response = await fetch('/api/interactions?limit=10');
			const data = await response.json();
			interactions = data.interactions || [];
		} catch (error) {
			interactions = [];
		}
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 transition-all duration-500">
	{#if showNotification}
		<div class="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg transform transition-all duration-300 z-50">
			Action completed! ({clickCount} total clicks)
		</div>
	{/if}

	<div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8 transform transition-all duration-500">
		{#if currentView === 'welcome'}
			<div class="text-center mb-8">
				<h1 class="text-3xl font-bold text-gray-900 mb-2">Welcome</h1>
				<p class="text-gray-600">A beautiful interface to get you started</p>
				{#if clickCount > 0}
					<p class="text-sm text-blue-600 mt-2">Total interactions: {clickCount}</p>
				{/if}
			</div>
			
			<div class="space-y-4">
				<button onclick={handleGetStarted} class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105">
					Get Started
				</button>
				
				<button onclick={handleLearnMore} class="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105">
					Learn More
				</button>
			</div>
			
			<div class="mt-8 pt-6 border-t border-gray-200">
				<div class="grid grid-cols-3 gap-4 text-center">
					<button onclick={() => selectFeature('fast')} class="p-3 rounded-lg transition-all duration-200 {selectedFeature === 'fast' ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:bg-gray-50'}">
						<div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
							<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
							</svg>
						</div>
						<p class="text-sm font-medium text-gray-900">Fast</p>
						{#if selectedFeature === 'fast'}
							<p class="text-xs text-blue-600 mt-1">Lightning speed performance!</p>
						{/if}
					</button>
					
					<button onclick={() => selectFeature('reliable')} class="p-3 rounded-lg transition-all duration-200 {selectedFeature === 'reliable' ? 'bg-green-50 ring-2 ring-green-500' : 'hover:bg-gray-50'}">
						<div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
							<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
						</div>
						<p class="text-sm font-medium text-gray-900">Reliable</p>
						{#if selectedFeature === 'reliable'}
							<p class="text-xs text-green-600 mt-1">Always works when you need it!</p>
						{/if}
					</button>
					
					<button onclick={() => selectFeature('simple')} class="p-3 rounded-lg transition-all duration-200 {selectedFeature === 'simple' ? 'bg-purple-50 ring-2 ring-purple-500' : 'hover:bg-gray-50'}">
						<div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
							<svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
							</svg>
						</div>
						<p class="text-sm font-medium text-gray-900">Simple</p>
						{#if selectedFeature === 'simple'}
							<p class="text-xs text-purple-600 mt-1">Easy to use and understand!</p>
						{/if}
					</button>
				</div>
			</div>

		{:else if currentView === 'dashboard'}
			<div class="text-center mb-6">
				<h1 class="text-3xl font-bold text-gray-900 mb-2">API Dashboard</h1>
				<p class="text-gray-600">Test and interact with backend services</p>
			</div>
			
			<div class="space-y-6 max-h-96 overflow-y-auto">
				<!-- API Health Check -->
				<div class="border border-gray-200 p-4 rounded-lg">
					<h3 class="font-semibold text-gray-900 mb-3">API Health Check</h3>
					<button onclick={() => testApiEndpoint('')} class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors">
						Test API Status
					</button>
					{#if apiResults['']}
						<pre class="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">{JSON.stringify(apiResults[''], null, 2)}</pre>
					{/if}
				</div>

				<!-- Data Processing -->
				<div class="border border-gray-200 p-4 rounded-lg">
					<h3 class="font-semibold text-gray-900 mb-3">Data Processing</h3>
					
					<div class="space-y-3">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Processing Type</label>
							<select bind:value={processingType} class="w-full border border-gray-300 rounded px-3 py-1 text-sm">
								<option value="calculation">Calculation</option>
								<option value="transformation">Transformation</option>
								<option value="validation">Validation</option>
							</select>
						</div>
						
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Data (JSON or text)</label>
							<textarea bind:value={processingData} placeholder="[1,2,3,4,5] or 'hello world'" class="w-full border border-gray-300 rounded px-3 py-2 text-sm h-20"></textarea>
						</div>
						
						<button onclick={processData} class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition-colors">
							Process Data
						</button>
						
						{#if apiResults.process}
							<pre class="text-xs bg-gray-100 p-2 rounded overflow-x-auto">{JSON.stringify(apiResults.process, null, 2)}</pre>
						{/if}
					</div>
				</div>

				<!-- Analytics -->
				<div class="border border-gray-200 p-4 rounded-lg">
					<h3 class="font-semibold text-gray-900 mb-3">Analytics</h3>
					<button onclick={loadAnalytics} class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm transition-colors">
						Load Analytics
					</button>
					{#if analyticsData}
						<div class="mt-3 space-y-2">
							{#if analyticsData.analytics}
								<div class="text-sm">
									<strong>Metrics:</strong> {analyticsData.analytics.metrics.pageViews} page views, {analyticsData.analytics.metrics.uniqueVisitors} unique visitors
								</div>
								<div class="text-sm">
									<strong>Performance:</strong> {analyticsData.analytics.performance.loadTime.toFixed(2)}ms avg load time
								</div>
							{/if}
							<pre class="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-32">{JSON.stringify(analyticsData, null, 2)}</pre>
						</div>
					{/if}
				</div>

				<!-- Interactions Log -->
				<div class="border border-gray-200 p-4 rounded-lg">
					<h3 class="font-semibold text-gray-900 mb-3">Recent Interactions</h3>
					<button onclick={loadInteractions} class="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded text-sm transition-colors">
						Load Recent Interactions
					</button>
					{#if interactions.length > 0}
						<div class="mt-3 space-y-1 max-h-32 overflow-y-auto">
							{#each interactions as interaction}
								<div class="text-xs bg-gray-50 p-2 rounded">
									<strong>{interaction.action}</strong> - {new Date(interaction.timestamp).toLocaleTimeString()}
									{#if interaction.metadata}
										<div class="text-gray-600">{JSON.stringify(interaction.metadata)}</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
				
				<button onclick={goBack} class="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors">
					← Back to Welcome
				</button>
			</div>

		{:else if currentView === 'features'}
			<div class="text-center mb-8">
				<h1 class="text-3xl font-bold text-gray-900 mb-2">Features</h1>
				<p class="text-gray-600">Discover what makes us special</p>
			</div>
			
			<div class="space-y-4">
				<div class="border border-gray-200 p-4 rounded-lg">
					<h3 class="font-semibold text-gray-900 mb-2">⚡ Lightning Fast</h3>
					<p class="text-sm text-gray-600">Built for speed and performance</p>
				</div>
				
				<div class="border border-gray-200 p-4 rounded-lg">
					<h3 class="font-semibold text-gray-900 mb-2">🛡️ Rock Solid</h3>
					<p class="text-sm text-gray-600">Reliable and secure by design</p>
				</div>
				
				<div class="border border-gray-200 p-4 rounded-lg">
					<h3 class="font-semibold text-gray-900 mb-2">💎 Simple & Clean</h3>
					<p class="text-sm text-gray-600">Intuitive interface that just works</p>
				</div>
				
				<button onclick={goBack} class="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors">
					← Back to Welcome
				</button>
			</div>
		{/if}
	</div>
</div>
