// Generate a 6-digit numeric room code
export function generateRoomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Validate room code format
export function isValidRoomCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}
