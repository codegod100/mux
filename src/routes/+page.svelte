<script>
	let clickCount = $state(0);
	let showNotification = $state(false);
	let apiResults = $state({});
	let processingData = $state('');
	let processingType = $state('calculation');
	let analyticsData = $state(null);
	let interactions = $state([]);
	let analyticsInterval = $state(null);
	let isAnalyticsLoading = $state(false);

	// Load analytics when component mounts
	$effect(() => {
		// Send page view event
		sendPageView();
		
		// Load initial analytics data
		loadAnalytics();
		
		// Set up interval to refresh analytics every 30 seconds
		analyticsInterval = setInterval(() => {
			loadAnalytics();
		}, 30000);
		
		// Clean up interval when component unmounts
		return () => {
			if (analyticsInterval) {
				clearInterval(analyticsInterval);
			}
		};
	});

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

	async function sendPageView() {
		try {
			await fetch('/api/analytics', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					url: '/dashboard',
					timestamp: new Date().toISOString()
				})
			});
		} catch (error) {
			console.error('Failed to send page view:', error);
		}
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
		isAnalyticsLoading = true;
		try {
			const response = await fetch('/api/analytics');
			const newData = await response.json();
			analyticsData = newData; // This should trigger reactivity
		} catch (error) {
			analyticsData = { error: error.message };
		} finally {
			isAnalyticsLoading = false;
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

	<div class="max-w-2xl w-full bg-white rounded-xl shadow-lg p-6 transform transition-all duration-500">
		<div class="text-center mb-8">
			<h1 class="text-3xl md:text-4xl font-bold text-gray-900 mb-3">API Dashboard</h1>
			<p class="text-gray-600 text-base md:text-lg">Test and interact with backend services</p>
		</div>
		
		<div class="space-y-6 md:space-y-8 max-h-[600px] overflow-y-auto pr-2">
			<!-- API Health Check -->
			<div class="border-2 border-gray-200 p-4 md:p-6 rounded-xl">
				<h3 class="font-semibold text-gray-900 mb-4 text-xl">API Health Check</h3>
				<button onclick={() => testApiEndpoint('')} class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 md:px-6 md:py-3 rounded-lg text-base transition-colors">
					Test API Status
				</button>
				{#if apiResults['']}
					<pre class="mt-4 text-sm bg-gray-100 p-4 rounded-lg overflow-x-auto">{JSON.stringify(apiResults[''], null, 2)}</pre>
				{/if}
			</div>

			<!-- Data Processing -->
			<div class="border-2 border-gray-200 p-4 md:p-6 rounded-xl">
				<h3 class="font-semibold text-gray-900 mb-4 text-xl">Data Processing</h3>
				
				<div class="space-y-4 md:space-y-5">
					<div>
						<label class="block text-base font-medium text-gray-700 mb-2">Processing Type</label>
						<select bind:value={processingType} class="w-full border-2 border-gray-300 rounded-lg px-3 py-2 md:px-4 md:py-3 text-base">
							<option value="calculation">Calculation</option>
							<option value="transformation">Transformation</option>
							<option value="validation">Validation</option>
						</select>
					</div>
					
					<div>
						<label class="block text-base font-medium text-gray-700 mb-2">Data (JSON or text)</label>
						<textarea bind:value={processingData} placeholder="[1,2,3,4,5] or 'hello world'" class="w-full border-2 border-gray-300 rounded-lg px-3 py-2 md:px-4 md:py-3 text-base h-20 md:h-24"></textarea>
					</div>
					
					<button onclick={processData} class="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-4 py-3 md:px-6 md:py-3 rounded-lg text-base transition-colors">
						Process Data
					</button>
					
					{#if apiResults.process}
						<pre class="text-sm bg-gray-100 p-4 rounded-lg overflow-x-auto">{JSON.stringify(apiResults.process, null, 2)}</pre>
					{/if}
				</div>
			</div>

			<!-- Analytics -->
			<div class="border-2 border-gray-200 p-4 md:p-6 rounded-xl">
				<h3 class="font-semibold text-gray-900 mb-4 text-xl">Analytics</h3>
				<button onclick={loadAnalytics} class="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 md:px-6 md:py-3 rounded-lg text-base transition-colors flex items-center justify-center gap-2">
					{#if isAnalyticsLoading}
						<span class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-white border-r-transparent align-[-0.125em]"></span>
						<span>Loading...</span>
					{:else}
						<span>Load Analytics</span>
					{/if}
				</button>
				{#if analyticsData}
					<div class="mt-4 space-y-3">
						{#if analyticsData.analytics}
							<div class="text-base">
								<strong>Metrics:</strong> {analyticsData.analytics.metrics.pageViews} page views, {analyticsData.analytics.metrics.uniqueVisitors} unique visitors
							</div>
							<div class="text-base">
								<strong>Performance:</strong> {analyticsData.analytics.performance.loadTime.toFixed(2)}ms avg load time
							</div>
						{/if}
						<pre class="text-sm bg-gray-100 p-4 rounded-lg overflow-x-auto max-h-40">{JSON.stringify(analyticsData, null, 2)}</pre>
					</div>
				{/if}
			</div>

			<!-- Interactions Log -->
			<div class="border-2 border-gray-200 p-4 md:p-6 rounded-xl">
				<h3 class="font-semibold text-gray-900 mb-4 text-xl">Recent Interactions</h3>
				<button onclick={loadInteractions} class="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 md:px-6 md:py-3 rounded-lg text-base transition-colors">
					Load Recent Interactions
				</button>
				{#if interactions.length > 0}
					<div class="mt-4 space-y-2 max-h-40 overflow-y-auto">
						{#each interactions as interaction}
							<div class="text-sm bg-gray-50 p-3 rounded-lg">
								<strong>{interaction.action}</strong> - {new Date(interaction.timestamp).toLocaleTimeString()}
								{#if interaction.metadata}
									<div class="text-gray-600 mt-1">{JSON.stringify(interaction.metadata)}</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
