import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// Create an item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { campaignId, name, type, contents, discovered, x, y } = body;

    const item = await prisma.item.create({
      data: {
        campaignId,
        name,
        type,
        contents,
        discovered: discovered ?? false,
        x,
        y,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error creating item:', error);
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}
