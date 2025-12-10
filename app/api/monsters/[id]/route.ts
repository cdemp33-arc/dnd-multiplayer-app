import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// Update monster
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const monster = await prisma.monster.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(monster);
  } catch (error) {
    console.error('Error updating monster:', error);
    return NextResponse.json({ error: 'Failed to update monster' }, { status: 500 });
  }
}

// Delete monster
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.monster.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting monster:', error);
    return NextResponse.json({ error: 'Failed to delete monster' }, { status: 500 });
  }
}
