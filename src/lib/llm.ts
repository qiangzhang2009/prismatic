/**
 * Prismatic LLM Provider Abstraction
 * Supports OpenAI, Anthropic, DeepSeek and local models
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: 'stop' | 'length' | 'content_filter';
}

export interface LLMOptions {
  model?: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

export interface LLMProvider {
  chat(options: LLMOptions): Promise<LLMResponse>;
  chatStream?(options: LLMOptions): AsyncGenerator<string, void, unknown>;
}

// ─── OpenAI Provider ──────────────────────────────────────────────────────

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey?: string, baseURL: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.baseURL = baseURL;
  }

  async chat(options: LLMOptions): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model ?? 'gpt-4o',
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
          top_p: options.topP,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      return {
        content: data.choices[0]?.message?.content ?? '',
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
        finishReason: data.choices[0]?.finish_reason,
      };
    } catch (err) {
      clearTimeout(timeout);
      if ((err as Error).name === 'AbortError') {
        throw new Error('OpenAI API request timed out after 30 seconds');
      }
      throw err;
    }
  }

  async *chatStream(options: LLMOptions): AsyncGenerator<string, void, unknown> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model ?? 'gpt-4o',
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {}
        }
      }
    }
  }
}

// ─── Anthropic Provider ───────────────────────────────────────────────────

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey?: string, baseURL: string = 'https://api.anthropic.com/v1') {
    this.apiKey = apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
    this.baseURL = baseURL;
  }

  async chat(options: LLMOptions): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      // Convert messages to Anthropic format
      const systemMessage = options.messages.find(m => m.role === 'system')?.content ?? '';
      const userMessages = options.messages.filter(m => m.role !== 'system');

      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: options.model ?? 'claude-sonnet-4-20250514',
          system: systemMessage,
          messages: userMessages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      return {
        content: data.content?.[0]?.text ?? '',
        usage: {
          promptTokens: data.usage?.input_tokens ?? 0,
          completionTokens: data.usage?.output_tokens ?? 0,
          totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
        },
        finishReason: data.stop_reason,
      };
    } catch (err) {
      clearTimeout(timeout);
      if ((err as Error).name === 'AbortError') {
        throw new Error('Anthropic API request timed out after 30 seconds');
      }
      throw err;
    }
  }
}

// ─── DeepSeek Provider ────────────────────────────────────────────────────

export class DeepSeekProvider implements LLMProvider {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey?: string, baseURL: string = 'https://api.deepseek.com') {
    this.apiKey = apiKey ?? process.env.DEEPSEEK_API_KEY ?? '';
    this.baseURL = baseURL;
  }

  async chat(options: LLMOptions): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    console.log('[DeepSeekProvider] chat() model:', options.model ?? 'deepseek-chat', 'msgs:', options.messages.length, 'key present:', !!this.apiKey);

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model ?? 'deepseek-chat',
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
          top_p: options.topP,
        }),
        signal: controller.signal,
      });
      console.log('[DeepSeekProvider] Response status:', response.status);
      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        console.error('[DeepSeekProvider] API error:', response.status, error);
        throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      console.log('[DeepSeekProvider] Success, content length:', data.choices?.[0]?.message?.content?.length);

      return {
        content: data.choices[0]?.message?.content ?? '',
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
        finishReason: data.choices[0]?.finish_reason,
      };
    } catch (err) {
      clearTimeout(timeout);
      if ((err as Error).name === 'AbortError') {
        throw new Error('DeepSeek API request timed out after 30 seconds');
      }
      throw err;
    }
  }

  async *chatStream(options: LLMOptions): AsyncGenerator<string, void, unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model ?? 'deepseek-chat',
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
          stream: true,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if ((err as Error).name === 'AbortError') {
        throw new Error('DeepSeek API stream timed out after 60 seconds');
      }
      throw err;
    }

    if (!response.ok || !response.body) {
      clearTimeout(timeout);
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) yield content;
            } catch {}
          }
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────

export function createLLMProvider(type: 'openai' | 'anthropic' | 'deepseek' = 'deepseek'): LLMProvider {
  switch (type) {
    case 'deepseek':
      return new DeepSeekProvider();
    case 'anthropic':
      return new AnthropicProvider();
    case 'openai':
    default:
      return new OpenAIProvider();
  }
}

// ─── Singleton export ────────────────────────────────────────────────────

let _provider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (!_provider) {
    // Default to DeepSeek for cost efficiency
    _provider = new DeepSeekProvider();
  }
  return _provider;
}

export function setLLMProvider(provider: LLMProvider) {
  _provider = provider;
}
