'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DMHomePage() {
  const [campaignName, setCampaignName] = useState('');
  const [dmName, setDmName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const createCampaign = async () => {
    if (!campaignName.trim()) return;
    
    setIsCreating(true);
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: campaignName, dmName }),
      });
      
      const campaign = await response.json();
      router.push(`/dm/${campaign?.id}`);
    } catch (error) {
      console.error('Error creating campaign:', error);
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎲</div>
          <h1 className="text-3xl font-bold text-white mb-2">Dungeon Master</h1>
          <p className="text-gray-400">Create a new campaign to begin</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-white font-semibold mb-2">Your Name (Optional)</label>
            <input
              type="text"
              value={dmName}
              onChange={(e) => setDmName(e.target.value)}
              placeholder="Enter your name..."
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-white font-semibold mb-2">Campaign Name</label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Enter campaign name..."
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  createCampaign();
                }
              }}
            />
          </div>
          
          <button
            onClick={createCampaign}
            disabled={!campaignName.trim() || isCreating}
            className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
          >
            {isCreating ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}
