'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Sword, Plus, Trash2, Upload, Dices, Package } from 'lucide-react';
import { initSocket } from '@/lib/socket-client';
import { rollDice } from '@/lib/dice';
import type { Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';

export default function PlayerInterface() {
  const router = useRouter();
  const { toast } = useToast();
  const [gameState, setGameState] = useState<'join' | 'create-character' | 'playing'>('join');
  const [roomCode, setRoomCode] = useState('');
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [character, setCharacter] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [combatActive, setCombatActive] = useState(false);

  const [creationStep, setCreationStep] = useState(1);
  const [newCharacter, setNewCharacter] = useState<any>({
    name: '',
    class: '',
    level: 1,
    xp: 0,
    hp: 10,
    maxHp: 10,
    ac: 10,
    speed: 30,
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    attacks: [],
    spells: [],
    inventory: [],
  });

  const [newAttack, setNewAttack] = useState({ name: '', toHit: 0, damage: '1d8' });
  const [newSpell, setNewSpell] = useState({ name: '', damage: '1d6', slots: 3, slotsUsed: 0 });
  const [newItem, setNewItem] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (playerId && campaignId && socket) {
      socket.on('game-state:updated', (updates: any) => {
        setCombatActive(updates?.combatActive ?? false);
      });

      socket.on('combat:started', (data: any) => {
        setCombatActive(true);
        toast({ title: 'Combat Started!', description: 'Roll initiative!' });
      });

      socket.on('combat:ended', () => {
        setCombatActive(false);
        toast({ title: 'Combat Ended' });
      });

      socket.on('xp:awarded', async (data: any) => {
        if (data?.characterId === character?.id) {
          setCharacter((prev: any) => {
            if (!prev) return prev;
            return { ...prev, xp: data.newXP, level: data.newLevel };
          });

          await fetch(`/api/characters/${character?.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xp: data.newXP, level: data.newLevel }),
          });

          toast({
            title: 'XP Gained!',
            description: `You gained ${data.amount} XP! You are now level ${data.newLevel}`,
          });
        }
      });

      socket.on('loot:received', (data: any) => {
        if (data?.playerId === playerId) {
          setCharacter((prev: any) => {
            if (!prev) return prev;
            return { ...prev, inventory: [...prev.inventory, data.loot] };
          });
          toast({
            title: 'Loot Received!',
            description: data.loot,
          });
        }
      });

      return () => {
        socket.off('game-state:updated');
        socket.off('combat:started');
        socket.off('combat:ended');
        socket.off('xp:awarded');
        socket.off('loot:received');
      };
    }
  }, [playerId, campaignId, socket, character?.id]);

  const handleJoinGame = async () => {
    if (!roomCode.trim() || roomCode.length !== 6) {
      toast({ title: 'Invalid Room Code', description: 'Please enter a 6-digit room code', variant: 'destructive' });
      return;
    }

    try {
      const response = await fetch(`/api/campaigns/by-code/${roomCode}`);
      const campaign = await response.json();

      if (campaign?.error) {
        toast({ title: 'Error', description: campaign.error, variant: 'destructive' });
        return;
      }

      setCampaignId(campaign?.id);

      const playerResponse = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign?.id }),
      });

      const player = await playerResponse.json();
      setPlayerId(player?.id);

      setGameState('create-character');
    } catch (error) {
      console.error('Error joining game:', error);
      toast({ title: 'Error', description: 'Failed to join game', variant: 'destructive' });
    }
  };

  const handleTokenUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewCharacter({ ...newCharacter, tokenImage: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const addAttack = () => {
    if (!newAttack.name.trim()) return;
    setNewCharacter({
      ...newCharacter,
      attacks: [...newCharacter.attacks, { ...newAttack, id: Date.now().toString() }],
    });
    setNewAttack({ name: '', toHit: 0, damage: '1d8' });
  };

  const removeAttack = (id: string) => {
    setNewCharacter({
      ...newCharacter,
      attacks: newCharacter.attacks.filter((a: any) => a.id !== id),
    });
  };

  const addSpell = () => {
    if (!newSpell.name.trim()) return;
    setNewCharacter({
      ...newCharacter,
      spells: [...newCharacter.spells, { ...newSpell, id: Date.now().toString() }],
    });
    setNewSpell({ name: '', damage: '1d6', slots: 3, slotsUsed: 0 });
  };

  const removeSpell = (id: string) => {
    setNewCharacter({
      ...newCharacter,
      spells: newCharacter.spells.filter((s: any) => s.id !== id),
    });
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    setNewCharacter({
      ...newCharacter,
      inventory: [...newCharacter.inventory, newItem],
    });
    setNewItem('');
  };

  const removeItem = (index: number) => {
    setNewCharacter({
      ...newCharacter,
      inventory: newCharacter.inventory.filter((_: any, i: number) => i !== index),
    });
  };

  const finishCharacterCreation = async () => {
    if (!playerId || !campaignId) return;

    try {
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          ...newCharacter,
          stats: {
            str: newCharacter.str,
            dex: newCharacter.dex,
            con: newCharacter.con,
            int: newCharacter.int,
            wis: newCharacter.wis,
            cha: newCharacter.cha,
          },
        }),
      });

      const savedCharacter = await response.json();
      setCharacter(savedCharacter);

      const socketInstance = await initSocket();
      setSocket(socketInstance);

      socketInstance.emit('player:join', { campaignId, playerId });

      setGameState('playing');

      toast({ title: 'Character Created!', description: `Welcome, ${savedCharacter.name}!` });
    } catch (error) {
      console.error('Error creating character:', error);
      toast({ title: 'Error', description: 'Failed to create character', variant: 'destructive' });
    }
  };

  const getClassSuggestions = () => [
    { name: 'Fighter', desc: 'Strong warrior who fights with weapons' },
    { name: 'Wizard', desc: 'Casts powerful magic spells' },
    { name: 'Rogue', desc: 'Sneaky and quick, great at hiding' },
    { name: 'Cleric', desc: 'Heals friends and fights evil' },
    { name: 'Ranger', desc: 'Expert with bows and nature' },
  ];

  const getStatModifier = (stat: number) => {
    return Math.floor((stat - 10) / 2);
  };

  const rollInitiative = () => {
    const initiative = rollDice('1d20');
    socket?.emit('player:roll-initiative', {
      campaignId,
      playerId,
      playerName: character?.name,
      initiative,
    });
    toast({
      title: 'Initiative Rolled!',
      description: `You rolled ${initiative}`,
    });
  };

  if (gameState === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <Sword className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
            <h1 className="text-3xl font-bold text-white mb-2">Join Adventure</h1>
            <p className="text-gray-400">Enter the room code from your DM</p>
          </div>

          <div className="space-y-4">
            <div>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                className="w-full bg-gray-700 text-white text-center text-2xl font-bold px-4 py-4 rounded-lg outline-none focus:ring-4 focus:ring-blue-500 uppercase tracking-widest"
                maxLength={6}
              />
            </div>

            <button
              onClick={handleJoinGame}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 rounded-lg transition-all transform hover:scale-105"
            >
              Join Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'create-character') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto bg-gray-800 rounded-lg shadow-2xl p-6 my-8">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">Create Your Hero</h2>
              <span className="text-gray-400">Step {creationStep} of 4</span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`flex-1 h-2 rounded ${step <= creationStep ? 'bg-blue-500' : 'bg-gray-600'}`}
                />
              ))}
            </div>
          </div>

          {creationStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-white font-semibold mb-2">Character Name</label>
                <input
                  type="text"
                  value={newCharacter.name}
                  onChange={(e) => setNewCharacter({ ...newCharacter, name: e.target.value })}
                  placeholder="Enter your hero's name..."
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                />
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">Class</label>
                <input
                  type="text"
                  value={newCharacter.class}
                  onChange={(e) => setNewCharacter({ ...newCharacter, class: e.target.value })}
                  placeholder="What type of hero are you?"
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-lg mb-3"
                />

                <div className="grid grid-cols-1 gap-2">
                  {getClassSuggestions().map((cls) => (
                    <button
                      key={cls.name}
                      onClick={() => setNewCharacter({ ...newCharacter, class: cls.name })}
                      className="bg-gray-700 hover:bg-gray-600 p-3 rounded-lg text-left transition-colors"
                    >
                      <div className="font-semibold text-white">{cls.name}</div>
                      <div className="text-sm text-gray-400">{cls.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-semibold mb-2">Level</label>
                  <input
                    type="number"
                    value={newCharacter.level}
                    onChange={(e) => setNewCharacter({ ...newCharacter, level: parseInt(e.target.value) || 1 })}
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-white font-semibold mb-2">Hit Points</label>
                  <input
                    type="number"
                    value={newCharacter.maxHp}
                    onChange={(e) =>
                      setNewCharacter({
                        ...newCharacter,
                        maxHp: parseInt(e.target.value) || 10,
                        hp: parseInt(e.target.value) || 10,
                      })
                    }
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                onClick={() => setCreationStep(2)}
                disabled={!newCharacter.name || !newCharacter.class}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
              >
                Next: Stats
              </button>
            </div>
          )}

          {creationStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-white font-semibold mb-2">Armor Class (AC)</label>
                <input
                  type="number"
                  value={newCharacter.ac}
                  onChange={(e) => setNewCharacter({ ...newCharacter, ac: parseInt(e.target.value) || 10 })}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">Speed</label>
                <input
                  type="number"
                  value={newCharacter.speed}
                  onChange={(e) => setNewCharacter({ ...newCharacter, speed: parseInt(e.target.value) || 30 })}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-white font-semibold mb-3">Ability Scores</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((stat) => (
                    <div key={stat} className="bg-gray-700 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-semibold uppercase">{stat}</span>
                        <span className="text-blue-400 font-bold">
                          {getStatModifier(newCharacter[stat]) >= 0 ? '+' : ''}
                          {getStatModifier(newCharacter[stat])}
                        </span>
                      </div>
                      <input
                        type="number"
                        value={newCharacter[stat]}
                        onChange={(e) =>
                          setNewCharacter({
                            ...newCharacter,
                            [stat]: parseInt(e.target.value) || 10,
                          })
                        }
                        className="w-full bg-gray-600 text-white px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        max="20"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setCreationStep(1)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg"
                >
                  Back
                </button>
                <button
                  onClick={() => setCreationStep(3)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg"
                >
                  Next: Attacks
                </button>
              </div>
            </div>
          )}

          {creationStep === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-white font-semibold mb-3">Attacks</label>

                {newCharacter.attacks.map((attack: any) => (
                  <div key={attack.id} className="bg-gray-700 p-3 rounded-lg mb-2 flex items-center justify-between">
                    <div>
                      <div className="text-white font-semibold">{attack.name}</div>
                      <div className="text-sm text-gray-400">
                        +{attack.toHit} to hit | {attack.damage} damage
                      </div>
                    </div>
                    <button onClick={() => removeAttack(attack.id)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}

                <div className="bg-gray-700 p-4 rounded-lg space-y-3">
                  <input
                    type="text"
                    value={newAttack.name}
                    onChange={(e) => setNewAttack({ ...newAttack, name: e.target.value })}
                    placeholder="Attack name (e.g., Longsword)"
                    className="w-full bg-gray-600 text-white px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={newAttack.toHit}
                      onChange={(e) => setNewAttack({ ...newAttack, toHit: parseInt(e.target.value) || 0 })}
                      placeholder="To Hit Bonus"
                      className="w-full bg-gray-600 text-white px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={newAttack.damage}
                      onChange={(e) => setNewAttack({ ...newAttack, damage: e.target.value })}
                      placeholder="Damage (1d8)"
                      className="w-full bg-gray-600 text-white px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={addAttack}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Attack
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-white font-semibold mb-3">Spells</label>

                {newCharacter.spells.map((spell: any) => (
                  <div key={spell.id} className="bg-gray-700 p-3 rounded-lg mb-2 flex items-center justify-between">
                    <div>
                      <div className="text-white font-semibold">{spell.name}</div>
                      <div className="text-sm text-gray-400">
                        {spell.damage} damage | {spell.slots} uses
                      </div>
                    </div>
                    <button onClick={() => removeSpell(spell.id)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}

                <div className="bg-gray-700 p-4 rounded-lg space-y-3">
                  <input
                    type="text"
                    value={newSpell.name}
                    onChange={(e) => setNewSpell({ ...newSpell, name: e.target.value })}
                    placeholder="Spell name (e.g., Fireball)"
                    className="w-full bg-gray-600 text-white px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newSpell.damage}
                      onChange={(e) => setNewSpell({ ...newSpell, damage: e.target.value })}
                      placeholder="Damage (3d6)"
                      className="w-full bg-gray-600 text-white px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      value={newSpell.slots}
                      onChange={(e) => setNewSpell({ ...newSpell, slots: parseInt(e.target.value) || 3, slotsUsed: 0 })}
                      placeholder="Uses"
                      className="w-full bg-gray-600 text-white px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={addSpell}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Spell
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-white font-semibold mb-3">Starting Items</label>

                {newCharacter.inventory.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {newCharacter.inventory.map((item: string, index: number) => (
                      <div key={index} className="bg-gray-700 p-3 rounded-lg flex items-center justify-between">
                        <div className="text-white">{item}</div>
                        <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-gray-700 p-4 rounded-lg space-y-3">
                  <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="Item name (e.g., Healing Potion)"
                    className="w-full bg-gray-600 text-white px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addItem();
                      }
                    }}
                  />
                  <button
                    onClick={addItem}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setCreationStep(2)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg"
                >
                  Back
                </button>
                <button
                  onClick={() => setCreationStep(4)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg"
                >
                  Next: Token
                </button>
              </div>
            </div>
          )}

          {creationStep === 4 && (
            <div className="space-y-6">
              <div>
                <label className="block text-white font-semibold mb-3">Character Token</label>
                <p className="text-gray-400 mb-4">Upload an image or use your initial</p>

                {newCharacter.tokenImage ? (
                  <div className="text-center">
                    <img
                      src={newCharacter.tokenImage}
                      alt="Token"
                      className="w-32 h-32 rounded-full mx-auto mb-4 object-cover border-4 border-blue-500"
                    />
                    <button
                      onClick={() => setNewCharacter({ ...newCharacter, tokenImage: '' })}
                      className="text-red-400 hover:text-red-300"
                    >
                      Remove Image
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block w-full">
                      <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors">
                        <Upload className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p className="text-gray-400">Click to upload image</p>
                        <p className="text-sm text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleTokenUpload} className="hidden" />
                    </label>

                    <div className="mt-4">
                      <p className="text-gray-400 text-sm mb-2">Or use your initial:</p>
                      <div className="w-32 h-32 rounded-full mx-auto bg-blue-600 flex items-center justify-center text-6xl font-bold text-white border-4 border-blue-400">
                        {newCharacter.name.charAt(0).toUpperCase() || '?'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setCreationStep(3)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg"
                >
                  Back
                </button>
                <button
                  onClick={finishCharacterCreation}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg"
                >
                  Finish & Join Game!
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'playing' && character) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-gray-800 rounded-lg p-4 mb-4 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold text-white border-4 border-blue-400 flex-shrink-0">
                {character?.tokenImage ? (
                  <img src={character.tokenImage} alt={character.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  character.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white">{character.name}</h2>
                <p className="text-gray-400">
                  {character.class} - Level {character.level}
                </p>
                <div className="flex gap-4 mt-1 text-sm">
                  <span className="text-gray-300">AC {character.ac}</span>
                  <span className="text-gray-300">Speed {character.speed}ft</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Hit Points</span>
                <span className="text-white font-semibold">
                  {character.hp}/{character.maxHp}
                </span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-3">
                <div
                  className="bg-red-500 h-3 rounded-full transition-all"
                  style={{ width: `${(character.hp / character.maxHp) * 100}%` }}
                />
              </div>
            </div>

            <div className="mt-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Experience</span>
                <span className="text-white font-semibold">{character.xp} XP</span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all"
                  style={{ width: `${((character.xp % 1000) / 1000) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {combatActive && (
            <div className="bg-gray-800 rounded-lg p-4 mb-4 shadow-lg">
              <h3 className="text-white font-semibold mb-3">Combat Active</h3>
              <button
                onClick={rollInitiative}
                className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <Dices className="w-5 h-5" />
                Roll Initiative
              </button>
            </div>
          )}

          <div className="bg-gray-800 rounded-lg p-4 mb-4 shadow-lg">
            <h3 className="text-white font-semibold mb-3">Ability Scores</h3>
            <div className="grid grid-cols-3 gap-2">
              {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((stat) => (
                <div key={stat} className="bg-gray-700 p-3 rounded text-center">
                  <div className="text-xs text-gray-400 uppercase">{stat}</div>
                  <div className="text-2xl font-bold text-white">{character[stat]}</div>
                  <div className="text-sm text-blue-400">
                    {getStatModifier(character[stat]) >= 0 ? '+' : ''}
                    {getStatModifier(character[stat])}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {character.attacks?.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 mb-4 shadow-lg">
              <h3 className="text-white font-semibold mb-3">Attacks</h3>
              <div className="space-y-2">
                {character.attacks.map((attack: any) => (
                  <div key={attack.id} className="bg-gray-700 p-3 rounded-lg">
                    <div className="font-semibold text-white">{attack.name}</div>
                    <div className="text-sm text-gray-400">
                      +{attack.toHit} to hit - {attack.damage} damage
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {character.spells?.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 mb-4 shadow-lg">
              <h3 className="text-white font-semibold mb-3">Spells</h3>
              <div className="space-y-2">
                {character.spells.map((spell: any) => (
                  <div key={spell.id} className="bg-gray-700 p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold text-white">{spell.name}</div>
                      <div className="text-sm text-gray-400">
                        {spell.slots - spell.slotsUsed}/{spell.slots} left
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">{spell.damage} damage</div>
                    <div className="flex gap-1 mt-2">
                      {[...Array(spell.slots)].map((_: any, i: number) => (
                        <div
                          key={i}
                          className={`flex-1 h-2 rounded ${i < spell.slots - spell.slotsUsed ? 'bg-purple-500' : 'bg-gray-600'}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-800 rounded-lg p-4 mb-4 shadow-lg">
            <h3 className="text-white font-semibold mb-3">Inventory</h3>
            {character.inventory?.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 mx-auto mb-2 text-gray-500" />
                <p className="text-gray-400">No items in inventory</p>
                <p className="text-sm text-gray-500 mt-1">Find items during your adventure!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {character.inventory.map((item: string, index: number) => (
                  <div key={index} className="bg-gray-700 p-3 rounded-lg flex items-center justify-between">
                    <span className="font-semibold text-white">{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
