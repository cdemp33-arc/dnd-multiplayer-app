import { NextRequest, NextResponse } from 'next/server';
import { Server } from 'socket.io';
import { createServer } from 'http';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

let io: Server | null = null;

if (!global.io) {
  const httpServer = createServer();
  global.io = new Server(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Socket.io event handlers
  global.io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // DM joins campaign room
    socket.on('dm:join', async (campaignId: string) => {
      socket.join(`campaign:${campaignId}`);
      socket.data.campaignId = campaignId;
      socket.data.role = 'dm';
      console.log(`DM joined campaign: ${campaignId}`);
    });

    // Player joins campaign room
    socket.on('player:join', async ({ campaignId, playerId }: { campaignId: string; playerId: string }) => {
      socket.join(`campaign:${campaignId}`);
      socket.data.campaignId = campaignId;
      socket.data.playerId = playerId;
      socket.data.role = 'player';

      // Update player socket ID
      await prisma.player.update({
        where: { id: playerId },
        data: { socketId: socket.id, isConnected: true },
      });

      // Notify DM of new player
      const player = await prisma.player.findUnique({
        where: { id: playerId },
        include: { character: true },
      });
      
      socket.to(`campaign:${campaignId}`).emit('player:connected', player);
      console.log(`Player ${playerId} joined campaign: ${campaignId}`);
    });

    // Game state updates from DM
    socket.on('dm:update-game-state', async (data: any) => {
      const { campaignId, ...updates } = data;
      socket.to(`campaign:${campaignId}`).emit('game-state:updated', updates);
    });

    // Monster updates
    socket.on('dm:update-monster', async (data: any) => {
      const { campaignId, ...updates } = data;
      socket.to(`campaign:${campaignId}`).emit('monster:updated', updates);
    });

    // Item updates
    socket.on('dm:update-item', async (data: any) => {
      const { campaignId, ...updates } = data;
      socket.to(`campaign:${campaignId}`).emit('item:updated', updates);
    });

    // Combat updates
    socket.on('dm:start-combat', async (data: any) => {
      socket.to(`campaign:${data.campaignId}`).emit('combat:started', data);
    });

    socket.on('dm:end-combat', async (data: any) => {
      socket.to(`campaign:${data.campaignId}`).emit('combat:ended', data);
    });

    socket.on('dm:next-turn', async (data: any) => {
      socket.to(`campaign:${data.campaignId}`).emit('combat:turn-changed', data);
    });

    socket.on('dm:update-initiative', async (data: any) => {
      socket.to(`campaign:${data.campaignId}`).emit('combat:initiative-updated', data);
    });

    // XP and loot
    socket.on('dm:award-xp', async (data: any) => {
      socket.to(`campaign:${data.campaignId}`).emit('xp:awarded', data);
    });

    socket.on('dm:give-loot', async (data: any) => {
      socket.to(`campaign:${data.campaignId}`).emit('loot:received', data);
    });

    // Player actions
    socket.on('player:action', async (data: any) => {
      socket.to(`campaign:${data.campaignId}`).emit('player:action-pending', data);
    });

    socket.on('player:roll-initiative', async (data: any) => {
      socket.to(`campaign:${data.campaignId}`).emit('player:initiative-rolled', data);
    });

    // Combat log
    socket.on('dm:combat-log', async (data: any) => {
      socket.to(`campaign:${data.campaignId}`).emit('combat:log-updated', data);
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log('Client disconnected:', socket.id);
      
      if (socket.data.playerId) {
        await prisma.player.update({
          where: { id: socket.data.playerId },
          data: { isConnected: false },
        }).catch(() => {});
        
        if (socket.data.campaignId) {
          socket.to(`campaign:${socket.data.campaignId}`).emit('player:disconnected', {
            playerId: socket.data.playerId,
          });
        }
      }
    });
  });
}

io = global.io;

export async function GET(req: NextRequest) {
  return NextResponse.json({ success: true });
}

declare global {
  var io: Server | undefined;
}
