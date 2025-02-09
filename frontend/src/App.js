import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home'; // Strona główna z logowaniem
import SelectSongs from './components/SelectSongs';
import GeneratedPlaylist from './components/GeneratedPlaylist';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} /> {/* Strona główna */}
        <Route path="/select_songs" element={<SelectSongs />} />
        <Route path="/generated_playlist" element={<GeneratedPlaylist />} />
      </Routes>
    </Router>
  );
}

export default App;
