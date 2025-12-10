import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateRoomCode } from '@/lib/room-code';

export const dynamic = 'force-dynamic';

// Create a new campaign
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, dmName } = body;

    // Generate unique room code
    let roomCode = generateRoomCode();
    let existing = await prisma.campaign.findUnique({ where: { roomCode } });
    
    while (existing) {
      roomCode = generateRoomCode();
      existing = await prisma.campaign.findUnique({ where: { roomCode } });
    }

    const campaign = await prisma.campaign.create({
      data: {
        name,
        dmName,
        roomCode,
        gameState: {
          create: {
            encounterName: 'New Encounter',
            gridSize: 50,
            showGrid: true,
            combatActive: false,
            currentTurn: 0,
          },
        },
        combatState: {
          create: {
            initiativeOrder: [],
            combatLog: [],
          },
        },
      },
      include: {
        gameState: true,
        combatState: true,
      },
    });

    return NextResponse.json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}

// Get all campaigns (for testing/admin)
export async function GET() {
  try {
    const campaigns = await prisma.campaign.findMany({
      include: {
        players: {
          include: {
            character: true,
          },
        },
        gameState: true,
      },
    });
    return NextResponse.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}
