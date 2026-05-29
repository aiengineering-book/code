// packages/server/src/lib/agent/tools/weather-tool.ts
// #book ch14-weather-tool
// ch14-tool-calling/server/src/lib/agent/tools/weather-tool.ts
import { z } from 'zod';
import { env } from '../../../env.js';
import { ValidatedTool } from './base-tool.js';

const WeatherInputSchema = z.object({
  city: z.string().min(1).max(100),
  unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
});

const WeatherOutputSchema = z.object({
  city: z.string(),
  temperature: z.number(),
  unit: z.string(),
  condition: z.string(),
  humidity: z.number().min(0).max(100),
  windSpeed: z.number().min(0),
});

type WeatherInput = z.infer<typeof WeatherInputSchema>;
type WeatherOutput = z.infer<typeof WeatherOutputSchema>;

export class WeatherTool extends ValidatedTool<WeatherInput, WeatherOutput> {
  readonly name = 'get_weather';
  readonly description = `Get current weather for a specified city.
Returns temperature (Celsius or Fahrenheit), weather condition, humidity, and wind speed.
Supports city names in English and other languages.`;

  // JSON Schema — provided to OpenAI
  readonly inputSchema = {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: 'City name, e.g. "London" or "Tokyo"',
      },
      unit: {
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        description: 'Temperature unit, defaults to celsius',
      },
    },
    required: ['city'],
  };

  // Zod schema — for internal validation
  protected readonly zodSchema = WeatherInputSchema;
  readonly outputSchema = WeatherOutputSchema;

  protected async run(input: WeatherInput): Promise<WeatherOutput> {
    // In production: call a weather API (e.g. OpenWeatherMap)
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(input.city)}&units=${input.unit === 'celsius' ? 'metric' : 'imperial'}&appid=${env.WEATHER_API_KEY}`,
    );

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      name: string;
      main: { temp: number; humidity: number };
      weather: Array<{ description: string }>;
      wind: { speed: number };
    };

    return {
      city: data.name,
      temperature: Math.round(data.main.temp),
      unit: input.unit === 'celsius' ? '°C' : '°F',
      condition: data.weather[0]?.description ?? 'unknown',
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
    };
  }
}
// #endbook
