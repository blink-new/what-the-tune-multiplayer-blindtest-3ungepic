import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Play, Pause, Volume2, Clock, Trophy, Users, Music } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { RealtimeChannel } from '@supabase/supabase-js'

interface Player {
  id: string
  name: string
  score: number
  current_answer?: string
}

interface Song {
  id: number
  song_title: string
  artist_name: string
  preview_url: string
}

export function GameInterface() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const audioRef = useRef<HTMLAudioElement>(null)

  // Game state
  const [currentRound, setCurrentRound] = useState(0)
  const [totalRounds, setTotalRounds] = useState(0)
  const [timeLeft, setTimeLeft] = useState(15)
  const [isPlaying, setIsPlaying] = useState(false)
  const [gamePhase, setGamePhase] = useState<'waiting' | 'playing' | 'reveal' | 'finished'>('waiting')
  
  // Answer state
  const [titleAnswer, setTitleAnswer] = useState('')
  const [artistAnswer, setArtistAnswer] = useState('')
  const [hasSubmitted, setHasSubmitted] = useState(false)
  
  // Data
  const [players, setPlayers] = useState<Player[]>([])
  const [songs, setSongs] = useState<Song[]>([])
  const [room, setRoom] = useState<{ id: string; host_id: string; status: string; current_round: number } | null>(null)
  const [isHost, setIsHost] = useState(false)

  const currentSong = songs[currentRound]

  useEffect(() => {
    const playerId = localStorage.getItem('playerId')
    const storedRoomCode = localStorage.getItem('roomCode')

    console.log("GameInterface useEffect triggered.");
    console.log("localStorage - playerId:", playerId);
    console.log("localStorage - storedRoomCode:", storedRoomCode);
    console.log("URL roomCode:", roomCode);

    if (!playerId || storedRoomCode !== roomCode) {
      console.log("Redirecting from GameInterface: playerId or roomCode missing/mismatch", { playerId, storedRoomCode, roomCode })
      navigate('/')
      return
    }

    let roomChannel: RealtimeChannel | null = null;
    let playerChannel: RealtimeChannel | null = null;

    const fetchGameData = async () => {
      console.log("Fetching game data in GameInterface...");
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error("Error getting user for RLS in GameInterface:", userError)
        toast({ title: 'Authentication error', description: 'Please try again.', variant: 'destructive' })
        navigate('/')
        return
      }
      console.log("Authenticated user ID in GameInterface:", user.user?.id)

      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, host_id, status, current_round')
        .eq('room_code', roomCode)
        .single()

      if (roomError || !roomData) {
        console.error("Error fetching room in GameInterface:", roomError)
        toast({ title: 'Error fetching room', variant: 'destructive' })
        navigate('/')
        return
      }

      console.log("Setting room data in GameInterface:", roomData);
      setRoom(roomData)
      setIsHost(roomData.host_id === playerId)
      setCurrentRound(roomData.current_round)

      const { data: playersData, error: playersError } = await supabase.from('players').select('*').eq('room_id', roomData.id)
      if (playersError) {
        console.error("Error fetching players in GameInterface:", playersError);
        toast({ title: 'Error fetching players', variant: 'destructive' });
      } else {
        console.log("Initial fetched players in GameInterface:", playersData);
        setPlayers(playersData || [])
      }

      const { data: songsData, error: songsError } = await supabase.from('game_songs').select('*').eq('room_id', roomData.id)
      if (songsError) {
        console.error("Error fetching songs in GameInterface:", songsError);
        toast({ title: 'Error fetching songs', variant: 'destructive' });
      } else {
        console.log("Initial fetched songs in GameInterface:", songsData);
        setSongs(songsData || [])
        setTotalRounds(songsData?.length || 0)
      }

      if (roomData.status === 'playing') {
        setGamePhase('playing')
      } else if (roomData.status === 'finished') {
        navigate(`/results/${roomCode}`)
      }

      // Realtime subscriptions
      roomChannel = supabase
        .channel(`room_game_${roomCode}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomData.id}` }, (payload) => {
          console.log("Realtime room update in GameInterface:", payload)
          const updatedRoom = payload.new as { id: string; host_id: string; status: string; current_round: number }
          setRoom(updatedRoom)
          setCurrentRound(updatedRoom.current_round)
          if (updatedRoom.status === 'finished') {
            navigate(`/results/${roomCode}`)
          } else if (updatedRoom.status === 'playing') {
            setGamePhase('playing')
            setTimeLeft(15)
            setHasSubmitted(false)
            setTitleAnswer('')
            setArtistAnswer('')
          }
        })
        .subscribe()
        console.log("Subscribed to room_game channel.");

      playerChannel = supabase
        .channel(`players_game_${roomCode}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomData.id}` }, (payload) => {
          console.log("Realtime player update in GameInterface:", payload)
          if (payload.eventType === 'INSERT') {
            setPlayers((prev) => [...prev, payload.new as Player])
          } else if (payload.eventType === 'DELETE') {
            setPlayers((prev) => prev.filter(p => p.id !== (payload.old as Player).id))
          } else if (payload.eventType === 'UPDATE') {
            setPlayers((prev) => prev.map(p => p.id === (payload.new as Player).id ? payload.new as Player : p))
          }
        })
        .subscribe()
        console.log("Subscribed to players_game channel.");
    }

    fetchGameData()

    return () => {
      if (roomChannel) {
        console.log("Unsubscribing from room channel:", `room_game_${roomCode}`)
        supabase.removeChannel(roomChannel)
      }
      if (playerChannel) {
        console.log("Unsubscribing from player channel:", `players_game_${roomCode}`)
        supabase.removeChannel(playerChannel)
      }
    }
  }, [roomCode, navigate, toast])

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    
    if (gamePhase === 'playing' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGamePhase('reveal')
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    
    return () => clearInterval(interval)
  }, [gamePhase, timeLeft])

  // Audio effect
  useEffect(() => {
    if (audioRef.current && currentSong) {
      audioRef.current.src = currentSong.preview_url
      if (gamePhase === 'playing') {
        audioRef.current.play().catch(e => console.error("Audio play failed", e))
        setIsPlaying(true)
      } else {
        audioRef.current.pause()
        setIsPlaying(false)
      }
    }
  }, [currentSong, gamePhase])

  const handleSubmit = async () => {
    if (!titleAnswer.trim() && !artistAnswer.trim()) return
    setHasSubmitted(true)

    let score = 0
    const titleCorrect = currentSong && titleAnswer.trim().toLowerCase() === currentSong.song_title.toLowerCase()
    const artistCorrect = currentSong && artistAnswer.trim().toLowerCase() === currentSong.artist_name.toLowerCase()

    if (titleCorrect) score += 50
    if (artistCorrect) score += 50
    if (titleCorrect && artistCorrect) score += 20 // Bonus

    score += timeLeft // Time bonus

    const playerId = localStorage.getItem('playerId')
    if (playerId) {
      const currentPlayer = players.find(p => p.id === playerId)
      if (currentPlayer) {
        await supabase
          .from('players')
          .update({ score: currentPlayer.score + score, current_answer: `${titleAnswer} - ${artistAnswer}` })
          .eq('id', playerId)
      }
    }
  }

  const handleNextRound = async () => {
    if (!room || !isHost) return
    
    if (currentRound >= totalRounds - 1) {
      await supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id)
      navigate(`/results/${roomCode}`)
    } else {
      await supabase.from('rooms').update({ current_round: currentRound + 1 }).eq('id', room.id)
    }
  }

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play().catch(e => console.error("Audio play failed", e))
      }
      setIsPlaying(!isPlaying)
    }
  }

  if (!currentSong) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading game...</div>
  }

  return (
    <div className="min-h-screen p-4">
      {currentSong.preview_url && <audio ref={audioRef} src={currentSong.preview_url} />}
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-cyan-400 border-cyan-400">
              Room: {roomCode}
            </Badge>
            <Badge variant="outline" className="text-purple-400 border-purple-400">
              Round {currentRound + 1}/{totalRounds}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-white">{gamePhase === 'reveal' ? 'Round Results' : 'Listen & Guess!'}</h1>
          <div className="flex items-center gap-2 text-gray-400">
            <Users className="w-4 h-4" />
            <span>{players.length} players</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Game Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Music Player */}
            <Card className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Music className="w-5 h-5" />
                  Now Playing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <div className={`w-24 h-24 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center ${isPlaying ? 'animate-spin' : ''}`}>
                      <Button
                        variant="ghost"
                        size="lg"
                        onClick={togglePlay}
                        className="w-16 h-16 rounded-full bg-black/20 hover:bg-black/40 text-white"
                      >
                        {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span className="flex items-center gap-1"><Volume2 className="w-4 h-4" /> Audio</span>
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {timeLeft}s</span>
                  </div>
                  <Progress value={((15 - timeLeft) / 15) * 100} className="h-2" />
                </div>
                {gamePhase === 'reveal' && (
                  <div className="text-center p-4 rounded-lg bg-green-500/20 border border-green-500/30">
                    <h3 className="text-xl font-bold text-white mb-1">{currentSong.song_title}</h3>
                    <p className="text-green-400">by {currentSong.artist_name}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Answer Input */}
            {gamePhase === 'playing' && !hasSubmitted && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader><CardTitle className="text-white">Your Answers</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-300 text-sm mb-2 block">Song Title</label>
                      <Input value={titleAnswer} onChange={(e) => setTitleAnswer(e.target.value)} placeholder="Enter song title..." className="bg-slate-700 border-slate-600 text-white" onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
                    </div>
                    <div>
                      <label className="text-gray-300 text-sm mb-2 block">Artist</label>
                      <Input value={artistAnswer} onChange={(e) => setArtistAnswer(e.target.value)} placeholder="Enter artist name..." className="bg-slate-700 border-slate-600 text-white" onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
                    </div>
                  </div>
                  <Button onClick={handleSubmit} disabled={!titleAnswer.trim() && !artistAnswer.trim()} className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600">Submit Answer</Button>
                </CardContent>
              </Card>
            )}

            {hasSubmitted && gamePhase === 'playing' && (
              <Card className="bg-green-500/20 border-green-500/30">
                <CardContent className="text-center py-8">
                  <div className="text-green-400 mb-2">✓ Answer Submitted!</div>
                  <p className="text-gray-300">Waiting for other players...</p>
                </CardContent>
              </Card>
            )}

            {gamePhase === 'reveal' && isHost && (
              <Button onClick={handleNextRound} size="lg" className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600">
                {currentRound >= totalRounds - 1 ? 'View Final Results' : 'Next Round'}
              </Button>
            )}
          </div>

          {/* Leaderboard */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-800/50 border-slate-700 sticky top-4">
              <CardHeader><CardTitle className="text-white flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-400" />Live Leaderboard</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {players.sort((a, b) => b.score - a.score).map((player, index) => (
                    <div key={player.id} className={`flex items-center justify-between p-3 rounded-lg ${
                        index === 0 ? 'bg-yellow-500/20 border border-yellow-500/30' :
                        index === 1 ? 'bg-gray-400/20 border border-gray-400/30' :
                        index === 2 ? 'bg-orange-500/20 border border-orange-500/30' :
                        'bg-slate-700/50 border border-slate-600'
                      }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-500 text-black' :
                          index === 1 ? 'bg-gray-400 text-black' :
                          index === 2 ? 'bg-orange-500 text-black' :
                          'bg-slate-600 text-white'
                        }`}>{index + 1}</div>
                        <div>
                          <div className="text-white font-medium">{player.name}</div>
                          <div className="text-gray-400 text-xs">
                            {player.current_answer ? `Answered` : 'Playing...'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold">{player.score}</div>
                        <div className="text-gray-400 text-xs">points</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}