// Dice rolling utilities

export function rollDice(diceStr: string): number {
  // Parse dice string like "1d20", "2d6+3", "1d8"
  const match = diceStr.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) return 0;
  
  const numDice = parseInt(match[1] ?? '1');
  const sides = parseInt(match[2] ?? '6');
  const modifier = match[3] ? parseInt(match[3]) : 0;
  
  let total = modifier;
  for (let i = 0; i < numDice; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
}

export function rollDamage(damageStr: string): { total: number; rolls: number[]; modifier: number } {
  // Parse damage string like "1d8+3"
  const match = damageStr.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) return { total: 0, rolls: [], modifier: 0 };
  
  const numDice = parseInt(match[1] ?? '1');
  const sides = parseInt(match[2] ?? '6');
  const modifier = match[3] ? parseInt(match[3]) : 0;
  
  const rolls: number[] = [];
  let total = modifier;
  for (let i = 0; i < numDice; i++) {
    const roll = Math.floor(Math.random() * sides) + 1;
    rolls.push(roll);
    total += roll;
  }
  
  return { total, rolls, modifier };
}
