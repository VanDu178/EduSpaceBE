/**
 * Sinh mã Cuộc trò chuyện theo định dạng CHAT-YYYYMMDD-XXXX
 */
export function generateConversationCode(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `CHAT-${dateStr}-${randomSuffix}`;
}
