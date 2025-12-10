'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Upload, Eye, EyeOff, Trash2, Grid3x3, Play, SkipForward, Swords, Star, Gift, Copy, Package } from 'lucide-react';
import { initSocket } from '@/lib/socket-client';
import { rollDice } from '@/lib/dice';
import type { Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';

export default function DMInterface() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const campaignId = params?.id as string;

  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  const [encounterName, setEncounterName] = useState('New Encounter');
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState(50);
  const [showGrid, setShowGrid] = useState(true);
  const [notes, setNotes] = useState('');
  const [monsters, setMonsters] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  const [combatActive, setCombatActive] = useState(false);
  const [initiativeOrder, setInitiativeOrder] = useState<any[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [combatLog, setCombatLog] = useState<string[]>([]);

  const [selectedMonster, setSelectedMonster] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [placementMode, setPlacementMode] = useState<'monster' | 'item'>('monster');

  const [showMonsterForm, setShowMonsterForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showXPModal, setShowXPModal] = useState(false);
  const [showLootModal, setShowLootModal] = useState(false);
  const [showInitiativeRoll, setShowInitiativeRoll] = useState(false);

  const [newMonster, setNewMonster] = useState({
    name: '',
    hp: 10,
    maxHp: 10,
    ac: 10,
    damage: '1d6',
    xp: 50,
    loot: '',
    x: 100,
    y: 100,
    hidden: true,
  });

  const [newItem, setNewItem] = useState({
    name: '',
    type: 'chest',
    contents: '',
    discovered: false,
    x: 100,
    y: 100,
  });

  const [xpAmount, setXpAmount] = useState(50);
  const [lootToGive, setLootToGive] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCampaign();
  }, [campaignId]);

  useEffect(() => {
    const setupSocket = async () => {
      const socketInstance = await initSocket();
      setSocket(socketInstance);
      socketInstance.emit('dm:join', campaignId);

      socketInstance.on('player:connected', (player: any) => {
        toast({
          title: 'Player Connected',
          description: `${player?.character?.name || 'A player'} has joined the game`,
        });
        loadCampaign();
      });

      socketInstance.on('player:disconnected', () => {
        loadCampaign();
      });

      socketInstance.on('player:initiative-rolled', (data: any) => {
        addPlayerToInitiative(data?.playerName, data?.initiative);
      });
    };

    setupSocket();

    return () => {
      socket?.off('player:connected');
      socket?.off('player:disconnected');
      socket?.off('player:initiative-rolled');
    };
  }, [campaignId]);

  const loadCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`);
      const data = await response.json();

      if (data?.error) {
        router.push('/dm');
        return;
      }

      setCampaign(data);

      if (data?.gameState) {
        setEncounterName(data.gameState.encounterName ?? 'New Encounter');
        setMapImage(data.gameState.mapImage);
        setGridSize(data.gameState.gridSize ?? 50);
        setShowGrid(data.gameState.showGrid ?? true);
        setNotes(data.gameState.notes ?? '');
        setCombatActive(data.gameState.combatActive ?? false);
        setCurrentTurn(data.gameState.currentTurn ?? 0);
      }

      setMonsters(data?.monsters ?? []);
      setItems(data?.items ?? []);

      if (data?.combatState) {
        setInitiativeOrder(data.combatState.initiativeOrder ?? []);
        setCombatLog(data.combatState.combatLog ?? []);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading campaign:', error);
      setLoading(false);
    }
  };

  const updateGameState = async (updates: any) => {
    try {
      await fetch(`/api/game-state/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      socket?.emit('dm:update-game-state', { campaignId, ...updates });
    } catch (error) {
      console.error('Error updating game state:', error);
    }
  };

  const updateCombatState = async (updates: any) => {
    try {
      await fetch(`/api/combat-state/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (error) {
      console.error('Error updating combat state:', error);
    }
  };

  const handleMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result as string;
        setMapImage(imageData);
        updateGameState({ mapImage: imageData });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMapClick = (e: React.MouseEvent) => {
    if (isDragging || !mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const snappedX = showGrid ? Math.round(x / gridSize) * gridSize : x;
    const snappedY = showGrid ? Math.round(y / gridSize) * gridSize : y;

    if (placementMode === 'monster') {
      setNewMonster({ ...newMonster, x: snappedX, y: snappedY });
      setShowMonsterForm(true);
    } else {
      setNewItem({ ...newItem, x: snappedX, y: snappedY });
      setShowItemForm(true);
    }
  };

  const addMonster = async () => {
    if (!newMonster.name.trim()) return;

    try {
      const response = await fetch('/api/monsters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newMonster, campaignId }),
      });

      const monster = await response.json();
      setMonsters([...monsters, monster]);
      socket?.emit('dm:update-monster', { campaignId, action: 'add', monster });

      setNewMonster({
        name: '',
        hp: 10,
        maxHp: 10,
        ac: 10,
        damage: '1d6',
        xp: 50,
        loot: '',
        x: 100,
        y: 100,
        hidden: true,
      });
      setShowMonsterForm(false);
    } catch (error) {
      console.error('Error adding monster:', error);
    }
  };

  const addItem = async () => {
    if (!newItem.name.trim()) return;

    try {
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newItem, campaignId }),
      });

      const item = await response.json();
      setItems([...items, item]);
      socket?.emit('dm:update-item', { campaignId, action: 'add', item });

      setNewItem({
        name: '',
        type: 'chest',
        contents: '',
        discovered: false,
        x: 100,
        y: 100,
      });
      setShowItemForm(false);
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const toggleMonsterVisibility = async (monsterId: string) => {
    const monster = monsters.find((m) => m.id === monsterId);
    if (!monster) return;

    try {
      const updatedMonster = { ...monster, hidden: !monster.hidden };
      await fetch(`/api/monsters/${monsterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: !monster.hidden }),
      });

      setMonsters(monsters.map((m) => (m.id === monsterId ? updatedMonster : m)));
      socket?.emit('dm:update-monster', { campaignId, action: 'update', monster: updatedMonster });
    } catch (error) {
      console.error('Error toggling monster visibility:', error);
    }
  };

  const deleteMonster = async (monsterId: string) => {
    try {
      await fetch(`/api/monsters/${monsterId}`, { method: 'DELETE' });
      setMonsters(monsters.filter((m) => m.id !== monsterId));
      socket?.emit('dm:update-monster', { campaignId, action: 'delete', monsterId });

      if (selectedMonster?.id === monsterId) {
        setSelectedMonster(null);
      }
    } catch (error) {
      console.error('Error deleting monster:', error);
    }
  };

  const toggleItemDiscovered = async (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    try {
      const updatedItem = { ...item, discovered: !item.discovered };
      await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discovered: !item.discovered }),
      });

      setItems(items.map((i) => (i.id === itemId ? updatedItem : i)));
      socket?.emit('dm:update-item', { campaignId, action: 'update', item: updatedItem });
    } catch (error) {
      console.error('Error toggling item discovered:', error);
    }
  };

  const deleteItem = async (itemId: string) => {
    try {
      await fetch(`/api/items/${itemId}`, { method: 'DELETE' });
      setItems(items.filter((i) => i.id !== itemId));
      socket?.emit('dm:update-item', { campaignId, action: 'delete', itemId });

      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleMonsterMouseDown = (e: React.MouseEvent, monster: any) => {
    e.stopPropagation();
    setSelectedMonster(monster);
    setSelectedItem(null);
    setIsDragging(true);

    if (mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left - monster.x,
        y: e.clientY - rect.top - monster.y,
      });
    }
  };

  const handleItemMouseDown = (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    setSelectedItem(item);
    setSelectedMonster(null);
    setIsDragging(true);

    if (mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left - item.x,
        y: e.clientY - rect.top - item.y,
      });
    }
  };

  const handleMouseMove = async (e: React.MouseEvent) => {
    if (!isDragging || !mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left - dragOffset.x;
    let y = e.clientY - rect.top - dragOffset.y;

    if (showGrid) {
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }

    if (selectedMonster) {
      const updatedMonster = { ...selectedMonster, x, y };
      setSelectedMonster(updatedMonster);
      setMonsters(monsters.map((m) => (m.id === selectedMonster.id ? updatedMonster : m)));
    } else if (selectedItem) {
      const updatedItem = { ...selectedItem, x, y };
      setSelectedItem(updatedItem);
      setItems(items.map((i) => (i.id === selectedItem.id ? updatedItem : i)));
    }
  };

  const handleMouseUp = async () => {
    if (isDragging) {
      if (selectedMonster) {
        await fetch(`/api/monsters/${selectedMonster.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: selectedMonster.x, y: selectedMonster.y }),
        });
        socket?.emit('dm:update-monster', { campaignId, action: 'update', monster: selectedMonster });
      } else if (selectedItem) {
        await fetch(`/api/items/${selectedItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: selectedItem.x, y: selectedItem.y }),
        });
        socket?.emit('dm:update-item', { campaignId, action: 'update', item: selectedItem });
      }
    }
    setIsDragging(false);
  };

  const startCombat = async () => {
    const monstersWithInitiative = monsters
      .filter((m) => !m.hidden)
      .map((m) => ({
        id: m.id,
        name: m.name,
        initiative: rollDice('1d20'),
        type: 'monster' as const,
        hp: m.hp,
        maxHp: m.maxHp,
      }));

    const newInitiativeOrder = monstersWithInitiative.sort((a, b) => b.initiative - a.initiative);
    setInitiativeOrder(newInitiativeOrder);
    setCombatActive(true);
    setCurrentTurn(0);
    setShowInitiativeRoll(true);

    await updateGameState({ combatActive: true, currentTurn: 0 });
    await updateCombatState({ initiativeOrder: newInitiativeOrder });
    socket?.emit('dm:start-combat', { campaignId, initiativeOrder: newInitiativeOrder });

    addToCombatLog('Combat has begun!');
  };

  const endCombat = async () => {
    setCombatActive(false);
    setInitiativeOrder([]);
    setCurrentTurn(0);

    await updateGameState({ combatActive: false, currentTurn: 0 });
    await updateCombatState({ initiativeOrder: [] });
    socket?.emit('dm:end-combat', { campaignId });

    addToCombatLog('Combat ended.');
  };

  const nextTurn = async () => {
    const nextTurnIndex = (currentTurn + 1) % initiativeOrder.length;
    setCurrentTurn(nextTurnIndex);

    await updateGameState({ currentTurn: nextTurnIndex });
    socket?.emit('dm:next-turn', { campaignId, currentTurn: nextTurnIndex });

    const currentCreature = initiativeOrder[nextTurnIndex];
    if (currentCreature) {
      addToCombatLog(`${currentCreature.name}'s turn!`);
    }
  };

  const addPlayerToInitiative = (playerName: string, initiative: number) => {
    const newOrder = [
      ...initiativeOrder,
      {
        id: Date.now().toString(),
        name: playerName,
        initiative,
        type: 'player' as const,
      },
    ].sort((a, b) => b.initiative - a.initiative);

    setInitiativeOrder(newOrder);
    updateCombatState({ initiativeOrder: newOrder });
    socket?.emit('dm:update-initiative', { campaignId, initiativeOrder: newOrder });
  };

  const addToCombatLog = (message: string) => {
    const newLog = [...combatLog, message].slice(-10);
    setCombatLog(newLog);
    updateCombatState({ combatLog: newLog });
    socket?.emit('dm:combat-log', { campaignId, message });
  };

  const awardXPToAll = async () => {
    const players = campaign?.players ?? [];

    for (const player of players) {
      if (player?.character) {
        const newXP = (player.character.xp ?? 0) + xpAmount;
        const newLevel = Math.floor(newXP / 1000) + 1;

        await fetch(`/api/characters/${player.character.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ xp: newXP, level: newLevel }),
        });

        socket?.emit('dm:award-xp', {
          campaignId,
          playerId: player.id,
          characterId: player.character.id,
          amount: xpAmount,
          newXP,
          newLevel,
        });
      }
    }

    toast({
      title: 'XP Awarded',
      description: `All players received ${xpAmount} XP!`,
    });

    setShowXPModal(false);
    setXpAmount(50);
    loadCampaign();
  };

  const giveLoot = async () => {
    if (!lootToGive.trim() || !selectedPlayerId) return;

    socket?.emit('dm:give-loot', {
      campaignId,
      playerId: selectedPlayerId,
      loot: lootToGive,
    });

    toast({
      title: 'Loot Given',
      description: 'Item given to player!',
    });

    setShowLootModal(false);
    setLootToGive('');
    setSelectedPlayerId(null);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(campaign?.roomCode ?? '');
    toast({
      title: 'Room Code Copied',
      description: `${campaign?.roomCode} copied to clipboard`,
    });
  };

  const getItemIcon = (type: string) => {
    const icons: Record<string, string> = {
      chest: '📦',
      barrel: '🛢️',
      crate: '📦',
      scroll: '📜',
      potion: '🧪',
    };
    return icons[type] ?? '📦';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading campaign...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* Left Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
        {combatActive ? (
          <>
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
                  <Swords className="w-5 h-5" />
                  Combat
                </h2>
                <button onClick={endCombat} className="text-sm bg-red-600 hover:bg-red-700 px-3 py-1 rounded">
                  End Combat
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">Initiative Order</h3>
              {initiativeOrder.map((creature, index) => (
                <div
                  key={creature.id}
                  className={`p-3 rounded-lg transition-all ${
                    index === currentTurn
                      ? 'bg-green-600 border-2 border-green-400 ring-2 ring-green-300'
                      : 'bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-400">{index + 1}</span>
                        <div>
                          <div className="font-semibold">{creature.name}</div>
                          <div className="text-xs text-gray-400">Initiative: {creature.initiative}</div>
                        </div>
                      </div>
                      {creature.type === 'monster' && creature.hp != null && creature.maxHp != null && (
                        <div className="mt-2">
                          <div className="text-xs text-gray-400 mb-1">
                            HP: {creature.hp}/{creature.maxHp}
                          </div>
                          <div className="w-full bg-gray-600 rounded-full h-2">
                            <div
                              className="bg-red-500 h-2 rounded-full"
                              style={{ width: `${(creature.hp / creature.maxHp) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-700">
              <button
                onClick={nextTurn}
                className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <SkipForward className="w-5 h-5" />
                Next Turn
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 border-b border-gray-700">
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setPlacementMode('monster')}
                  className={`flex-1 py-2 rounded font-semibold transition-colors ${
                    placementMode === 'monster' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  Monsters
                </button>
                <button
                  onClick={() => setPlacementMode('item')}
                  className={`flex-1 py-2 rounded font-semibold transition-colors ${
                    placementMode === 'item' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  Items
                </button>
              </div>
              <p className="text-sm text-gray-400">Click map to place</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {placementMode === 'monster' ? (
                monsters.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>No monsters yet</p>
                    <p className="text-sm mt-2">Click the map to add one</p>
                  </div>
                ) : (
                  monsters.map((monster) => (
                    <div
                      key={monster.id}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedMonster?.id === monster.id
                          ? 'bg-blue-600 border-2 border-blue-400'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                      onClick={() => {
                        setSelectedMonster(monster);
                        setSelectedItem(null);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{monster.name}</h3>
                            {monster.hidden && <EyeOff className="w-4 h-4 text-gray-400" />}
                          </div>
                          <div className="text-sm text-gray-300 mt-1">
                            <div>
                              HP: {monster.hp}/{monster.maxHp}
                            </div>
                            <div>
                              AC: {monster.ac} | Damage: {monster.damage}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMonsterVisibility(monster.id);
                            }}
                            className="p-1 hover:bg-gray-600 rounded"
                          >
                            {monster.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMonster(monster.id);
                            }}
                            className="p-1 hover:bg-red-600 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : items.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No items yet</p>
                  <p className="text-sm mt-2">Click the map to add one</p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedItem?.id === item.id
                        ? 'bg-blue-600 border-2 border-blue-400'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    onClick={() => {
                      setSelectedItem(item);
                      setSelectedMonster(null);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getItemIcon(item.type)}</span>
                          <h3 className="font-semibold">{item.name}</h3>
                          {item.discovered && <span className="text-xs bg-green-600 px-2 py-0.5 rounded">Found</span>}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleItemDiscovered(item.id);
                          }}
                          className="p-1 hover:bg-gray-600 rounded"
                        >
                          {item.discovered ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteItem(item.id);
                          }}
                          className="p-1 hover:bg-red-600 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Center - Map Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={encounterName}
              onChange={(e) => {
                setEncounterName(e.target.value);
                updateGameState({ encounterName: e.target.value });
              }}
              className="bg-gray-700 px-3 py-2 rounded text-lg font-semibold border-none outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex items-center gap-2 bg-gray-700 px-3 py-2 rounded">
              <span className="text-sm text-gray-400">Room Code:</span>
              <span className="font-bold text-lg">{campaign?.roomCode}</span>
              <button onClick={copyRoomCode} className="p-1 hover:bg-gray-600 rounded" title="Copy room code">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowGrid(!showGrid);
                updateGameState({ showGrid: !showGrid });
              }}
              className={`px-4 py-2 rounded flex items-center gap-2 ${showGrid ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              <Grid3x3 className="w-4 h-4" />
              Grid
            </button>

            {!combatActive ? (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-green-600 rounded flex items-center gap-2 hover:bg-green-700"
                >
                  <Upload className="w-4 h-4" />
                  Upload Map
                </button>

                <button
                  onClick={startCombat}
                  disabled={monsters.filter((m) => !m.hidden).length === 0}
                  className="px-4 py-2 bg-red-600 rounded flex items-center gap-2 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" />
                  Start Combat
                </button>
              </>
            ) : (
              <button onClick={nextTurn} className="px-4 py-2 bg-blue-600 rounded flex items-center gap-2 hover:bg-blue-700">
                <SkipForward className="w-4 h-4" />
                Next Turn
              </button>
            )}

            <button
              onClick={() => setShowXPModal(true)}
              className="px-4 py-2 bg-yellow-600 rounded flex items-center gap-2 hover:bg-yellow-700"
            >
              <Star className="w-4 h-4" />
              Award XP
            </button>

            <button
              onClick={() => setShowLootModal(true)}
              className="px-4 py-2 bg-green-600 rounded flex items-center gap-2 hover:bg-green-700"
            >
              <Gift className="w-4 h-4" />
              Give Loot
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleMapUpload} className="hidden" />
        </div>

        <div className="flex-1 overflow-auto bg-gray-950 p-4">
          <div
            ref={mapRef}
            className="relative mx-auto cursor-crosshair"
            style={{
              width: mapImage ? 'auto' : '800px',
              height: mapImage ? 'auto' : '600px',
              maxWidth: '100%',
            }}
            onClick={handleMapClick}
          >
            {mapImage ? (
              <img src={mapImage} alt="Battle Map" className="max-w-full h-auto" draggable={false} />
            ) : (
              <div className="w-full h-full border-2 border-dashed border-gray-700 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Upload className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-xl">Upload a battle map to get started</p>
                  <p className="text-sm mt-2">Click Upload Map button above</p>
                </div>
              </div>
            )}

            {showGrid && mapImage && (
              <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ opacity: 0.3 }}>
                <defs>
                  <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                    <path
                      d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                      fill="none"
                      stroke="white"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            )}

            {monsters.map((monster) => (
              <div
                key={monster.id}
                className={`absolute cursor-move transition-transform hover:scale-110 ${
                  selectedMonster?.id === monster.id ? 'z-10' : 'z-0'
                }`}
                style={{
                  left: monster.x - 20,
                  top: monster.y - 20,
                  width: '40px',
                  height: '40px',
                }}
                onMouseDown={(e) => handleMonsterMouseDown(e, monster)}
              >
                <div
                  className={`w-full h-full rounded-full flex items-center justify-center text-white font-bold text-sm border-4 ${
                    monster.hidden
                      ? 'bg-gray-600 border-gray-500 opacity-60'
                      : 'bg-red-600 border-red-400'
                  } ${selectedMonster?.id === monster.id ? 'ring-4 ring-blue-400' : ''}`}
                >
                  {monster.name.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs whitespace-nowrap bg-black bg-opacity-75 px-2 py-1 rounded">
                  {monster.name}
                </div>
              </div>
            ))}

            {items.map((item) => (
              <div
                key={item.id}
                className={`absolute cursor-move transition-transform hover:scale-110 ${
                  selectedItem?.id === item.id ? 'z-10' : 'z-0'
                }`}
                style={{
                  left: item.x - 20,
                  top: item.y - 20,
                  width: '40px',
                  height: '40px',
                }}
                onMouseDown={(e) => handleItemMouseDown(e, item)}
              >
                <div
                  className={`w-full h-full rounded-lg flex items-center justify-center text-2xl border-4 ${
                    item.discovered
                      ? 'bg-green-600 border-green-400 opacity-70'
                      : 'bg-yellow-600 border-yellow-400'
                  } ${selectedItem?.id === item.id ? 'ring-4 ring-blue-400' : ''}`}
                >
                  {getItemIcon(item.type)}
                </div>
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs whitespace-nowrap bg-black bg-opacity-75 px-2 py-1 rounded">
                  {item.name}
                </div>
              </div>
            ))}
          </div>
        </div>

        {combatActive && combatLog.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-80 rounded-lg p-3 max-w-md">
            <h4 className="text-sm font-semibold text-gray-400 mb-2">Combat Log</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {combatLog.slice(-5).map((log, index) => (
                <div key={index} className="text-sm text-gray-300">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-purple-400">Players</h2>
          <p className="text-sm text-gray-400">{campaign?.players?.length ?? 0}/8 connected</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {campaign?.players?.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>No players yet</p>
              <p className="text-sm mt-2">Share the room code</p>
            </div>
          ) : (
            campaign?.players?.map((player: any) => (
              <div key={player.id} className="bg-gray-700 rounded-lg p-3">
                {player?.character ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{player.character.name}</h3>
                      <div
                        className={`w-2 h-2 rounded-full ${player.isConnected ? 'bg-green-500' : 'bg-red-500'}`}
                        title={player.isConnected ? 'Connected' : 'Disconnected'}
                      />
                    </div>
                    <div className="text-sm text-gray-300">
                      <div>
                        {player.character.class} - Level {player.character.level}
                      </div>
                      <div>
                        HP: {player.character.hp}/{player.character.maxHp}
                      </div>
                      <div>AC: {player.character.ac}</div>
                      <div className="text-xs text-gray-400 mt-1">XP: {player.character.xp}</div>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-400">Creating character...</div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-700">
          {selectedMonster && (
            <div className="bg-gray-700 rounded-lg p-3">
              <h3 className="font-semibold mb-2">{selectedMonster.name}</h3>
              <div className="text-sm space-y-1">
                <div>
                  HP: {selectedMonster.hp}/{selectedMonster.maxHp}
                </div>
                <div>AC: {selectedMonster.ac}</div>
                <div>Damage: {selectedMonster.damage}</div>
                <div>XP: {selectedMonster.xp}</div>
                {selectedMonster.loot && <div>Loot: {selectedMonster.loot}</div>}
              </div>
            </div>
          )}

          {selectedItem && (
            <div className="bg-gray-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{getItemIcon(selectedItem.type)}</span>
                <h3 className="font-semibold">{selectedItem.name}</h3>
              </div>
              {selectedItem.contents && (
                <div className="text-sm bg-gray-600 p-2 rounded mb-2">
                  <span className="text-gray-400">Contents:</span>
                  <p>{selectedItem.contents}</p>
                </div>
              )}
              <div className="text-sm">
                Status:{' '}
                <span className={selectedItem.discovered ? 'text-green-400' : 'text-gray-400'}>
                  {selectedItem.discovered ? 'Discovered' : 'Not Found'}
                </span>
              </div>
            </div>
          )}

          {!selectedMonster && !selectedItem && (
            <div>
              <h3 className="font-semibold mb-2">Encounter Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  updateGameState({ notes: e.target.value });
                }}
                placeholder="Add notes about this encounter..."
                className="w-full h-32 bg-gray-700 p-3 rounded resize-none outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showMonsterForm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Add Monster</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={newMonster.name}
                  onChange={(e) => setNewMonster({ ...newMonster, name: e.target.value })}
                  className="w-full bg-gray-700 px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Goblin"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">HP</label>
                  <input
                    type="number"
                    value={newMonster.hp}
                    onChange={(e) =>
                      setNewMonster({ ...newMonster, hp: parseInt(e.target.value) || 10, maxHp: parseInt(e.target.value) || 10 })
                    }
                    className="w-full bg-gray-700 px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">AC</label>
                  <input
                    type="number"
                    value={newMonster.ac}
                    onChange={(e) => setNewMonster({ ...newMonster, ac: parseInt(e.target.value) || 10 })}
                    className="w-full bg-gray-700 px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Damage</label>
                  <input
                    type="text"
                    value={newMonster.damage}
                    onChange={(e) => setNewMonster({ ...newMonster, damage: e.target.value })}
                    className="w-full bg-gray-700 px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1d6"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">XP</label>
                  <input
                    type="number"
                    value={newMonster.xp}
                    onChange={(e) => setNewMonster({ ...newMonster, xp: parseInt(e.target.value) || 50 })}
                    className="w-full bg-gray-700 px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Loot (optional)</label>
                <input
                  type="text"
                  value={newMonster.loot}
                  onChange={(e) => setNewMonster({ ...newMonster, loot: e.target.value })}
                  className="w-full bg-gray-700 px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="10 gold, healing potion"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newMonster.hidden}
                  onChange={(e) => setNewMonster({ ...newMonster, hidden: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm">Start hidden from players</label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={addMonster}
                className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded font-semibold"
              >
                Add Monster
              </button>
              <button onClick={() => setShowMonsterForm(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showItemForm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Add Item</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full bg-gray-700 px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Treasure Chest"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Type</label>
                <select
                  value={newItem.type}
                  onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                  className="w-full bg-gray-700 px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="chest">Chest</option>
                  <option value="barrel">Barrel</option>
                  <option value="crate">Crate</option>
                  <option value="scroll">Scroll</option>
                  <option value="potion">Potion</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Contents</label>
                <textarea
                  value={newItem.contents}
                  onChange={(e) => setNewItem({ ...newItem, contents: e.target.value })}
                  className="w-full bg-gray-700 px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                  placeholder="50 gold, healing potion, ancient map..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={addItem} className="flex-1 bg-yellow-600 hover:bg-yellow-700 py-2 rounded font-semibold">
                Add Item
              </button>
              <button onClick={() => setShowItemForm(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showXPModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-400" />
              Award Experience
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">XP Amount</label>
                <input
                  type="number"
                  value={xpAmount}
                  onChange={(e) => setXpAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-700 px-3 py-3 rounded outline-none focus:ring-2 focus:ring-yellow-500 text-lg"
                />
              </div>

              <div className="bg-gray-700 rounded p-3">
                <p className="text-sm text-gray-400">This will award {xpAmount} XP to all players</p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={awardXPToAll}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 py-3 rounded font-semibold"
              >
                Award to All
              </button>
              <button onClick={() => setShowXPModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showLootModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Gift className="w-6 h-6 text-green-400" />
              Give Loot
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Select Player</label>
                <select
                  value={selectedPlayerId ?? ''}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  className="w-full bg-gray-700 px-3 py-2 rounded outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Choose a player...</option>
                  {campaign?.players?.map((player: any) => (
                    <option key={player.id} value={player.id}>
                      {player?.character?.name || 'Unnamed Character'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Item/Loot</label>
                <input
                  type="text"
                  value={lootToGive}
                  onChange={(e) => setLootToGive(e.target.value)}
                  className="w-full bg-gray-700 px-3 py-3 rounded outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Healing Potion, 50 gold..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={giveLoot}
                disabled={!lootToGive.trim() || !selectedPlayerId}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-3 rounded font-semibold"
              >
                Give Loot
              </button>
              <button onClick={() => setShowLootModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showInitiativeRoll && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-center">Initiative Rolled!</h3>

            <div className="space-y-2 mb-6">
              {initiativeOrder.map((creature) => (
                <div key={creature.id} className="bg-gray-700 rounded p-3 flex items-center justify-between">
                  <span className="font-semibold">{creature.name}</span>
                  <span className="text-2xl font-bold text-blue-400">{creature.initiative}</span>
                </div>
              ))}
            </div>

            <p className="text-gray-400 text-center text-sm mb-4">Players will roll initiative on their devices</p>

            <button
              onClick={() => setShowInitiativeRoll(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold"
            >
              Start First Turn
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
