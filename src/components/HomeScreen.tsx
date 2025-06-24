import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Music, Users, Trophy, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

export function HomeScreen() {
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const handleCreateRoom = async () => {
    if (!playerName.trim()) return

    const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
    if (authError || !authData.user) {
      toast({ title: 'Error authenticating', description: authError?.message, variant: 'destructive' })
      return
    }
    const userId = authData.user.id

    const newRoomCode = generateRoomCode()

    // 1. Create a new room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({ room_code: newRoomCode })
      .select()
      .single()

    if (roomError || !room) {
      toast({ title: 'Error creating room', description: roomError?.message, variant: 'destructive' })
      return
    }

    // 2. Create a new player (the host) and link to the room
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ id: userId, name: playerName, is_host: true, room_id: room.id })
      .select()
      .single()

    if (playerError || !player) {
      toast({ title: 'Error creating player', description: playerError?.message, variant: 'destructive' })
      // Clean up the created room if player creation fails
      await supabase.from('rooms').delete().eq('id', room.id)
      return
    }

    // 3. Update the room with the host_id
    const { error: updateRoomError } = await supabase
      .from('rooms')
      .update({ host_id: player.id })
      .eq('id', room.id)

    if (updateRoomError) {
      toast({ title: 'Error finalizing room', description: updateRoomError.message, variant: 'destructive' })
      return
    }

    localStorage.setItem('playerId', player.id)
    localStorage.setItem('roomCode', newRoomCode)
    navigate(`/room/${newRoomCode}`)
  }

  const handleJoinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) return

    const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
    if (authError || !authData.user) {
      toast({ title: 'Error authenticating', description: authError?.message, variant: 'destructive' })
      return
    }
    const userId = authData.user.id

    // Find the room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, status')
      .eq('room_code', roomCode)
      .single()

    if (roomError || !room) {
      toast({ title: 'Room not found', description: 'Please check the code and try again.', variant: 'destructive' })
      return
    }

    if (room.status !== 'lobby') {
      toast({ title: 'Game in progress', description: 'This game has already started.', variant: 'destructive' })
      return
    }

    // Create a new player
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({ id: userId, name: playerName, room_id: room.id, is_host: false })
      .select()
      .single()

    if (playerError || !player) {
      toast({ title: 'Error joining room', description: playerError.message, variant: 'destructive' })
      return
    }

    localStorage.setItem('playerId', player.id)
    localStorage.setItem('roomCode', roomCode)
    navigate(`/room/${roomCode}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <Music className="w-16 h-16 text-pink-500 animate-pulse" />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-bounce" />
            </div>
          </div>
          <h1 className="text-6xl font-bold font-display bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent mb-4">
            What the Tune?
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Test your music knowledge in real-time multiplayer battles
          </p>
          
          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="flex flex-col items-center p-6 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
              <Users className="w-8 h-8 text-blue-400 mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Multiplayer</h3>
              <p className="text-gray-400 text-center">Play with friends in real-time</p>
            </div>
            <div className="flex flex-col items-center p-6 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
              <Zap className="w-8 h-8 text-yellow-400 mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Fast-Paced</h3>
              <p className="text-gray-400 text-center">Quick rounds, instant scoring</p>
            </div>
            <div className="flex flex-col items-center p-6 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
              <Trophy className="w-8 h-8 text-purple-400 mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Competitive</h3>
              <p className="text-gray-400 text-center">Climb the leaderboard</p>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer group hover:scale-105 transition-all duration-300 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30 hover:border-purple-400/50">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl text-white group-hover:text-purple-300 transition-colors">
                    Create Room
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Start a new game and invite friends
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-gray-400">Host your own music battle</p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Create New Room</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="create-name" className="text-gray-300">Your Name</Label>
                  <Input
                    id="create-name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your name"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <Button 
                  onClick={handleCreateRoom}
                  disabled={!playerName.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  Create Room
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer group hover:scale-105 transition-all duration-300 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30 hover:border-blue-400/50">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl text-white group-hover:text-blue-300 transition-colors">
                    Join Room
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Join an existing game with a room code
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Music className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-gray-400">Join the music challenge</p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Join Room</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="join-name" className="text-gray-300">Your Name</Label>
                  <Input
                    id="join-name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your name"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="room-code" className="text-gray-300">Room Code</Label>
                  <Input
                    id="room-code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="Enter room code"
                    className="bg-slate-800 border-slate-600 text-white text-center text-lg font-mono"
                  />
                </div>
                <Button 
                  onClick={handleJoinRoom}
                  disabled={!playerName.trim() || !roomCode.trim()}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                >
                  Join Room
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-400">
          <p>Built with ❤️ for music lovers</p>
        </div>
      </div>
    </div>
  )
}