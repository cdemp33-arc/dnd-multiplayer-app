import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// Create a monster
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { campaignId, name, hp, maxHp, ac, damage, xp, loot, x, y, hidden } = body;

    const monster = await prisma.monster.create({
      data: {
        campaignId,
        name,
        hp,
        maxHp,
        ac,
        damage,
        xp: xp ?? 50,
        loot,
        x,
        y,
        hidden: hidden ?? true,
      },
    });

    return NextResponse.json(monster);
  } catch (error) {
    console.error('Error creating monster:', error);
    return NextResponse.json({ error: 'Failed to create monster' }, { status: 500 });
  }
}
