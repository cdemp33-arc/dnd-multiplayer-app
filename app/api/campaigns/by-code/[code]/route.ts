import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// Get campaign by room code
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { roomCode: code },
      include: {
        players: {
          include: {
            character: {
              include: {
                attacks: true,
                spells: true,
                inventory: true,
              },
            },
          },
        },
        gameState: true,
        monsters: true,
        items: true,
        combatState: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check if room is full (max 8 players)
    if (campaign.players?.length >= 8) {
      return NextResponse.json({ error: 'Room is full' }, { status: 403 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign by code:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
  }
}
