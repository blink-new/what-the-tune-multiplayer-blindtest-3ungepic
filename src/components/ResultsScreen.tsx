import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Crown, Medal, Users, RotateCcw, Home, Share2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'

interface Player {
  id: string
  name: string
  score: number
}

export function ResultsScreen() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  
  const [players, setPlayers] = useState<Player[]>([])
  const [totalSongs, setTotalSongs] = useState(0)

  useEffect(() => {
    const playerId = localStorage.getItem('playerId')
    const storedRoomCode = localStorage.getItem('roomCode')

    console.log("ResultsScreen useEffect triggered.");
    console.log("localStorage - playerId:", playerId);
    console.log("localStorage - storedRoomCode:", storedRoomCode);
    console.log("URL roomCode:", roomCode);

    const fetchResults = async () => {
      console.log("Fetching results data in ResultsScreen...");
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id')
        .eq('room_code', roomCode)
        .single()

      if (roomError || !roomData) {
        console.error("Error fetching room in ResultsScreen:", roomError);
        toast({ title: 'Error fetching room', variant: 'destructive' });
        return;
      }
      console.log("Room data in ResultsScreen:", roomData);

      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomData.id)
        .order('score', { ascending: false })
      
      if (playersError) {
        console.error("Error fetching players in ResultsScreen:", playersError);
        toast({ title: 'Error fetching players', variant: 'destructive' });
      } else {
        console.log("Fetched players in ResultsScreen:", playersData);
        setPlayers(playersData || []);
      }

      const { count, error: songsError } = await supabase
        .from('game_songs')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomData.id)
      
      if (songsError) {
        console.error("Error fetching songs count in ResultsScreen:", songsError);
        toast({ title: 'Error fetching songs count', variant: 'destructive' });
      } else {
        console.log("Fetched total songs in ResultsScreen:", count);
        setTotalSongs(count || 0);
      }
    }

    fetchResults()
  }, [roomCode, toast])

  const playerRank = players.findIndex(p => p.id === localStorage.getItem('playerId')) + 1
  const player = players.find(p => p.id === localStorage.getItem('playerId'))

  const shareResults = () => {
    const text = `🎵 I just played What the Tune? and ranked #${playerRank} with ${player?.score} points! 🏆`
    if (navigator.share) {
      navigator.share({ title: 'What the Tune? Results', text, url: window.location.origin })
    } else {
      navigator.clipboard.writeText(text)
      toast({ title: "Results copied!", description: "Share your results with friends." })
    }
  }

  const playAgain = () => {
    navigate('/')
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-6 h-6 text-yellow-400" />
      case 2: return <Medal className="w-6 h-6 text-gray-400" />
      case 3: return <Medal className="w-6 h-6 text-orange-400" />
      default: return <Trophy className="w-6 h-6 text-gray-600" />
    }
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30'
      case 2: return 'from-gray-400/20 to-gray-500/20 border-gray-400/30'
      case 3: return 'from-orange-500/20 to-orange-600/20 border-orange-500/30'
      default: return 'from-slate-700/20 to-slate-800/20 border-slate-600/30'
    }
  }

  if (!player) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading results...</div>
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <Trophy className="w-16 h-16 text-yellow-400 animate-bounce" />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-pulse" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Game Complete!</h1>
          <Badge variant="outline" className="text-cyan-400 border-cyan-400 mb-4">
            Room: {roomCode}
          </Badge>
          <p className="text-gray-300">Thanks for playing! Here are the final results:</p>
        </div>

        {/* Personal Result Highlight */}
        <Card className={`mb-8 bg-gradient-to-r ${getRankColor(playerRank)}`}>
          <CardContent className="text-center py-8">
            <div className="flex items-center justify-center mb-4">{getRankIcon(playerRank)}</div>
            <h2 className="text-2xl font-bold text-white mb-2">You finished #{playerRank}!</h2>
            <div className="text-3xl font-bold text-white">{player.score} Points</div>
          </CardContent>
        </Card>

        {/* Full Leaderboard */}
        <Card className="mb-8 bg-slate-800/50 border-slate-700">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><Users className="w-5 h-5" />Final Leaderboard</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {players.map((p, index) => (
                <div key={p.id} className={`flex items-center justify-between p-4 rounded-lg bg-gradient-to-r ${getRankColor(index + 1)}`}>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center">{getRankIcon(index + 1)}</div>
                    <div>
                      <div className="text-white font-bold text-lg">{p.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold text-xl">{p.score}</div>
                    <div className="text-gray-400 text-sm">points</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={playAgain} size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 flex items-center gap-2"><RotateCcw className="w-5 h-5" />Play Again</Button>
          <Button onClick={shareResults} size="lg" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700 flex items-center gap-2"><Share2 className="w-5 h-5" />Share Results</Button>
          <Button onClick={() => navigate('/')} size="lg" variant="ghost" className="text-gray-400 hover:text-white flex items-center gap-2"><Home className="w-5 h-5" />Home</Button>
        </div>

        {/* Fun Stats */}
        <Card className="mt-8 bg-slate-800/30 border-slate-700">
          <CardHeader><CardTitle className="text-white text-center">Game Stats</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-cyan-400">{totalSongs}</div>
                <div className="text-gray-400 text-sm">Songs Played</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">{players.length}</div>
                <div className="text-gray-400 text-sm">Players</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{players[0]?.name}</div>
                <div className="text-gray-400 text-sm">Winner</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-8 text-gray-400"><p>Thanks for playing What the Tune? 🎵</p></div>
      </div>
    </div>
  )
}