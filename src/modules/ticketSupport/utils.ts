/**
 * Sinh mã Ticket theo định dạng TK-YYYYMMDD-XXXX
 */
export function generateTicketCode(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `TK-${dateStr}-${randomSuffix}`;
}
