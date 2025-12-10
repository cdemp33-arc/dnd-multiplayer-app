import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// Create a character
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { playerId, name, class: charClass, level, hp, maxHp, ac, speed, stats, attacks, spells, inventory, tokenImage } = body;

    const character = await prisma.character.create({
      data: {
        playerId,
        name,
        class: charClass,
        level: level ?? 1,
        xp: 0,
        hp,
        maxHp,
        ac,
        speed: speed ?? 30,
        str: stats?.str ?? 10,
        dex: stats?.dex ?? 10,
        con: stats?.con ?? 10,
        int: stats?.int ?? 10,
        wis: stats?.wis ?? 10,
        cha: stats?.cha ?? 10,
        tokenImage,
        attacks: {
          create: attacks?.map((a: any) => ({
            name: a.name,
            toHit: a.toHit,
            damage: a.damage,
          })) ?? [],
        },
        spells: {
          create: spells?.map((s: any) => ({
            name: s.name,
            damage: s.damage,
            slots: s.slots,
            slotsUsed: s.slotsUsed ?? 0,
          })) ?? [],
        },
        inventory: {
          create: inventory?.map((item: string) => ({
            name: item,
          })) ?? [],
        },
      },
      include: {
        attacks: true,
        spells: true,
        inventory: true,
      },
    });

    return NextResponse.json(character);
  } catch (error) {
    console.error('Error creating character:', error);
    return NextResponse.json({ error: 'Failed to create character' }, { status: 500 });
  }
}
