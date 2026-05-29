// packages/server/src/lib/agent/tools/weather-tool.ts
// #book ch14-weather-tool
import { z } from 'zod';
// ch14-tool-calling/server/src/lib/agent/tools/weather-tool.ts
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
  readonly description = `获取指定城市的当前天气信息。
返回温度（摄氏度或华氏度）、天气状况、湿度、风速。
支持中文和英文城市名。`;

  // JSON Schema，提供给 OpenAI
  readonly inputSchema = {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: '城市名称，支持中文和英文，如 "北京" 或 "Beijing"',
      },
      unit: {
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        description: '温度单位，默认 celsius（摄氏度）',
      },
    },
    required: ['city'],
  };

  // Zod schema，用于内部验证
  protected readonly zodSchema = WeatherInputSchema;
  readonly outputSchema = WeatherOutputSchema;

  protected async run(input: WeatherInput): Promise<WeatherOutput> {
    // 实际项目中调用天气 API（如 OpenWeatherMap）
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(input.city)}&units=${input.unit === 'celsius' ? 'metric' : 'imperial'}&appid=${env.WEATHER_API_KEY}`,
    );

    if (!response.ok) {
      throw new Error(
        `天气 API 错误：${response.status} ${response.statusText}`,
      );
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
      condition: data.weather[0]?.description ?? '未知',
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
    };
  }
}
// #endbook
