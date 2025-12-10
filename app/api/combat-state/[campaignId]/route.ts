import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// Update combat state
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const body = await req.json();

    const combatState = await prisma.combatState.update({
      where: { campaignId },
      data: body,
    });

    return NextResponse.json(combatState);
  } catch (error) {
    console.error('Error updating combat state:', error);
    return NextResponse.json({ error: 'Failed to update combat state' }, { status: 500 });
  }
}
