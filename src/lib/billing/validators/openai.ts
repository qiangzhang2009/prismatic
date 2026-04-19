/**
 * OpenAI API Key 验证器
 */
export async function validateOpenAIKey(
  key: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) return { valid: true };
    if (res.status === 401) return { valid: false, error: 'API Key 无效或已过期' };
    return { valid: false, error: `验证失败 (${res.status})` };
  } catch (err) {
    return { valid: false, error: '网络错误，请稍后重试' };
  }
}
