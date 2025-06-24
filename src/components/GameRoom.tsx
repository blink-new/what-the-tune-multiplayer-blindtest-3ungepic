import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Copy, Users, Crown, Play, ArrowLeft, Search, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { RealtimeChannel } from '@supabase/supabase-js'

interface Player {
  id: string
  name: string
  is_host: boolean
  score: number
}

interface Playlist {
  id: number
  title: string
  picture_medium: string
}

export function GameRoom() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [players, setPlayers] = useState<Player[]>([])
  const [room, setRoom] = useState<{ id: string; host_id: string; selected_playlist_id: number | null } | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [searchQuery, setSearchQuery] = useState('Top France')
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedPlaylist, setSelectedPlaylist] = useState<number | null>(null)
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false)

  // Use a ref to store the channel to avoid re-subscriptions
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const playerId = localStorage.getItem('playerId')
    const storedRoomCode = localStorage.getItem('roomCode')

    console.log("GameRoom useEffect triggered.");
    console.log("localStorage - playerId:", playerId);
    console.log("localStorage - storedRoomCode:", storedRoomCode);
    console.log("URL roomCode:", roomCode);

    if (!playerId || storedRoomCode !== roomCode) {
      console.log("Redirecting: playerId or roomCode missing/mismatch", { playerId, storedRoomCode, roomCode })
      navigate('/')
      return
    }

    const setupRealtime = (roomId: string) => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        console.log("Removed existing channel.");
      }

      channelRef.current = supabase
        .channel(`room_${roomCode}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
          (payload) => {
            console.log("Realtime player update:", payload);
            if (payload.eventType === 'INSERT') {
              setPlayers((prev) => {
                console.log("Adding player:", payload.new);
                return [...prev, payload.new as Player];
              });
            } else if (payload.eventType === 'DELETE') {
              setPlayers((prev) => {
                console.log("Removing player:", payload.old);
                return prev.filter(p => p.id !== (payload.old as Player).id);
              });
            } else if (payload.eventType === 'UPDATE') {
              setPlayers((prev) => {
                console.log("Updating player:", payload.new);
                return prev.map(p => p.id === (payload.new as Player).id ? payload.new as Player : p);
              });
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `room_code=eq.${roomCode}` },
          (payload) => {
            console.log("Realtime room update:", payload);
            setRoom(payload.new as { id: string; host_id: string; selected_playlist_id: number | null });
            setSelectedPlaylist((payload.new as { selected_playlist_id: number | null }).selected_playlist_id);
          }
        )
        .subscribe();
        console.log("Subscribed to new channel.");
    };

    const fetchInitialData = async () => {
      console.log("Fetching room data");
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, host_id, selected_playlist_id')
        .eq('room_code', roomCode)
        .single();

      if (roomError || !roomData) {
        console.error("Error fetching room:", roomError);
        toast({ title: 'Error fetching room', variant: 'destructive' });
        navigate('/');
        return;
      }

      console.log("Setting room data:", roomData);
      setRoom(roomData);
      setIsHost(roomData.host_id === playerId);
      console.log("isHost after setting:", roomData.host_id === playerId);
      setSelectedPlaylist(roomData.selected_playlist_id);

      console.log("Fetching players data for room_id:", roomData.id);
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomData.id);

      if (playersError) {
        console.error("Error fetching players:", playersError);
        toast({ title: 'Error fetching players', variant: 'destructive' });
      } else {
        console.log("Initial fetched players:", playersData);
        setPlayers(playersData || []);
      }

      // After initial data is fetched, set up realtime subscription
      setupRealtime(roomData.id);
    };

    fetchInitialData();

    return () => {
      if (channelRef.current) {
        console.log("Unsubscribing from channel:", `room_${roomCode}`);
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomCode, navigate, toast]);

  useEffect(() => {
    searchPlaylists();
  }, []);

  const searchPlaylists = async () => {
    if (!searchQuery.trim()) return
    setIsLoadingPlaylists(true)
    try {
      const { data, error } = await supabase.functions.invoke('deezer-playlists', {
        body: { query: searchQuery },
      })
      if (error) throw error
      console.log("Fetched playlists:", data.data);
      setPlaylists(data.data || [])
    } catch (error: unknown) {
      toast({ title: 'Error fetching playlists', description: (error as Error).message, variant: 'destructive' })
    } finally {
      setIsLoadingPlaylists(false)
    }
  }

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode || '')
    toast({
      title: "Room code copied!",
      description: "Share this code with your friends to join the game.",
    })
  }

  const handlePlaylistSelect = async (playlistId: number) => {
    setSelectedPlaylist(playlistId)
    if (room) {
      const { error } = await supabase
        .from('rooms')
        .update({ selected_playlist_id: playlistId })
        .eq('id', room.id)
      if (error) {
        toast({ title: 'Error selecting playlist', description: error.message, variant: 'destructive' })
      }
    }
  }

  const startGame = async () => {
    if (!selectedPlaylist || !room) return

    // Fetch tracks and save to DB
    try {
      const { data: tracksData, error: tracksError } = await supabase.functions.invoke('deezer-playlist-tracks', {
        body: { playlistId: selectedPlaylist },
      })
      if (tracksError) throw tracksError

      const songsToInsert = tracksData.data.data.slice(0, 10).map((track: { title: string; artist: { name: string; }; preview: string; }) => ({
        room_id: room.id,
        song_title: track.title,
        artist_name: track.artist.name,
        preview_url: track.preview,
      }))

      await supabase.from('game_songs').insert(songsToInsert)
      await supabase.from('rooms').update({ status: 'playing' }).eq('id', room.id)

      navigate(`/game/${roomCode}`)
    } catch (error: unknown) {
      toast({ title: 'Error starting game', description: (error as Error).message, variant: 'destructive' })
    }
  }

  const leaveRoom = async () => {
    const playerId = localStorage.getItem('playerId')
    if (playerId) {
      await supabase.from('players').delete().eq('id', playerId)
      localStorage.removeItem('playerId')
      localStorage.removeItem('roomCode')
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={leaveRoom}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Leave Room
          </Button>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Game Room</h1>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-cyan-400 border-cyan-400">
                Room Code: {roomCode}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyRoomCode}
                className="text-cyan-400 hover:text-cyan-300"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div /> {/* Spacer for centering */}
        </div>

        {/* Playlist Selection (Host only) */}
        {isHost && (
          <Card className="mb-8 bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Select a Playlist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for playlists..."
                  className="bg-slate-700 border-slate-600 text-white"
                  onKeyDown={(e) => e.key === 'Enter' && searchPlaylists()}
                />
                <Button onClick={searchPlaylists} disabled={isLoadingPlaylists}>
                  {isLoadingPlaylists ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-64 overflow-y-auto">
                {playlists.map(p => (
                  <div 
                    key={p.id} 
                    className={`relative rounded-lg overflow-hidden cursor-pointer border-2 ${selectedPlaylist === p.id ? 'border-purple-500' : 'border-transparent'}`}
                    onClick={() => handlePlaylistSelect(p.id)}
                  >
                    <img src={p.picture_medium} alt={p.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 flex items-end p-2">
                      <p className="text-white text-sm font-semibold line-clamp-2">{p.title}</p>
                    </div>
                    {selectedPlaylist === p.id && (
                      <div className="absolute inset-0 bg-purple-500/50 flex items-center justify-center">
                        <Play className="w-8 h-8 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Players List */}
        <Card className="mb-8 bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5" />
              Players ({players.length}/10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-white font-medium">{player.name}</div>
                      <div className="text-gray-400 text-sm">Ready to play</div>
                    </div>
                  </div>
                  {player.is_host && (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                      <Crown className="w-3 h-3 mr-1" />
                      Host
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="text-center">
          {isHost ? (
            <Button
              onClick={startGame}
              size="lg"
              disabled={players.length < 1 || !selectedPlaylist}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold px-8 py-3 text-lg"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Game
              {players.length < 1 && " (Need at least 1 player)"}
              {!selectedPlaylist && " (Select a playlist)"}
            </Button>
          ) : (
            <div className="text-gray-400">
              <Crown className="w-5 h-5 mx-auto mb-2" />
              Waiting for host to start the game...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}