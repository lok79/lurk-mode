/** 私有实现：外部不可 import（dependency-cruiser 会拦），随便改不影响调用方 */
export function formatGreeting(name: string): string {
  return `你好，${name}！我是一个深模块：小接口，大实现。`;
}
