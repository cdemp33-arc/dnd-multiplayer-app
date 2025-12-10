export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-6xl font-bold text-white mb-4">D&D Multiplayer</h1>
        <p className="text-xl text-gray-300 mb-8">Choose your role to begin your adventure</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <a
            href="/dm"
            className="bg-gradient-to-br from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 p-8 rounded-lg shadow-2xl transition-all transform hover:scale-105"
          >
            <div className="text-6xl mb-4">🎲</div>
            <h2 className="text-3xl font-bold text-white mb-2">Dungeon Master</h2>
            <p className="text-gray-200">Create campaigns and control the game</p>
          </a>
          
          <a
            href="/player"
            className="bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 p-8 rounded-lg shadow-2xl transition-all transform hover:scale-105"
          >
            <div className="text-6xl mb-4">⚔️</div>
            <h2 className="text-3xl font-bold text-white mb-2">Player</h2>
            <p className="text-gray-200">Join a game and create your character</p>
          </a>
        </div>
      </div>
    </div>
  );
}
