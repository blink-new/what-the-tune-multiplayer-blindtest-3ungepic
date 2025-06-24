import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { HomeScreen } from './components/HomeScreen'
import { GameRoom } from './components/GameRoom'
import { GameInterface } from './components/GameInterface'
import { ResultsScreen } from './components/ResultsScreen'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/room/:roomCode" element={<GameRoom />} />
          <Route path="/game/:roomCode" element={<GameInterface />} />
          <Route path="/results/:roomCode" element={<ResultsScreen />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App