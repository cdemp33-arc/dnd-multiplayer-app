import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// Create a player
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { campaignId } = body;

    const player = await prisma.player.create({
      data: {
        campaignId,
      },
    });

    return NextResponse.json(player);
  } catch (error) {
    console.error('Error creating player:', error);
    return NextResponse.json({ error: 'Failed to create player' }, { status: 500 });
  }
}
