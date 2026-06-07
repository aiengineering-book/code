// ch14-tool-calling/server/src/lib/agent/tools/design-examples.ts
// #book ch14-design-examples
// ch14-tool-calling/server/src/lib/agent/tools/design-examples.ts

// Principle 1: minimal required params, clear defaults on optional ones
const searchTool = {
  name: 'search_documents',
  description: 'Search the knowledge base for relevant documents',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Search keywords or question',
      },
      limit: {
        type: 'number',
        description: 'Number of results to return, default 5, max 20',
      },
      documentType: {
        type: 'string',
        enum: ['pdf', 'markdown', 'html', 'all'],
        description: 'Filter by document type, default "all" (no filter)',
      },
    },
    required: ['query'], // Only query is required
  },
};

// Principle 2: use enum to constrain finite choices, not an open string
const badEmailPriority = {
  priority: { type: 'string', description: 'Priority: low, medium, or high' },
};
const goodEmailPriority = {
  priority: {
    type: 'string',
    enum: ['low', 'medium', 'high'],
    description: 'Email priority level',
  },
};

// Principle 3: specify range and unit for numeric parameters
const badTimeout = {
  timeout: { type: 'number', description: 'Timeout' },
};
const goodTimeout = {
  timeoutSeconds: {
    type: 'number',
    description: 'Timeout in seconds, range 1-300, default 30',
  },
};

// Hard for the model to know what structure to pass
// Principle 4: avoid generic object parameters — model can't know what to pass
const badConfig = {
  config: { type: 'object', description: 'Configuration' },
};
// Break into specific named fields instead
const goodConfig = {
  temperature: { type: 'number', description: 'Temperature setting, 0.0-2.0' },
  maxTokens: { type: 'number', description: 'Maximum output token count' },
};

// Principle 5: underscore-separated verb+noun naming
// Good: create_todo, get_user_profile, search_web, send_email
// Bad:  todo, user, search, email

// Principle 6: describe the return format so the model knows what it's getting
const weatherTool = {
  name: 'get_weather',
  description: `Get current weather for a city.
Returns JSON: { city, temperature (Celsius or Fahrenheit), humidity (%), condition (sunny/cloudy/rainy/snowy), forecast (3-day) }`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      city: {
        type: 'string',
        description: 'City name, e.g. "London" or "Tokyo"',
      },
    },
    required: ['city'],
  },
};

// Principle 7: keep tool count below 10
// Too many tools dilutes the model's attention and reduces selection accuracy.
// If you have many tools, group them by scenario and inject only the relevant set.
// #endbook

// For illustration only; prevents TypeScript "unused variable" errors
void [
  searchTool,
  badEmailPriority,
  goodEmailPriority,
  badTimeout,
  goodTimeout,
  badConfig,
  goodConfig,
  weatherTool,
];

export {};
