import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Plot from 'react-plotly.js'; // Dodajemy Plotly.js
import './GeneratedPlaylist.css';

const GeneratedPlaylist = () => {
  const navigate = useNavigate();

  // Odbieramy dane przekazane z poprzedniej strony via location.state
  const location = useLocation();
  const playlist = location.state?.playlist || [];
  const accessToken = location.state?.accessToken || '';
  const playlistName = location.state?.playlistName || 'Generated Playlist';
  const objectiveValues = location.state?.objectiveValues || []; // Wartości funkcji celu
  const temperatures = location.state?.temperatures || []; // Temperatura na iteracje

  // Debug logs to verify incoming data
  useEffect(() => {
    console.log('Playlist Data:', playlist);
    console.log('Objective Values:', objectiveValues);
    console.log('Temperatures:', temperatures);
  }, [playlist, objectiveValues, temperatures]);

  // Remove duplicates in playlist based on track_id
  const uniquePlaylist = playlist.filter(
    (song, index, self) =>
      index === self.findIndex((t) => t.track_id === song.track_id)
  );

  // Funkcja wysyłająca playlistę do Spotify
  const handleSendToSpotify = async () => {
    try {
      const response = await axios.post('/create_spotify_playlist', {
        accessToken, // musi być ważny token do Spotify
        playlistName,
        tracks: uniquePlaylist,
      });
      console.log('Created Spotify playlist:', response.data);
      alert('Playlist created on your Spotify account!');
    } catch (error) {
      console.error('Error creating playlist:', error);
      alert('Failed to create playlist on Spotify');
    }
  };

  // Dodatkowo przycisk "Powrót" (jeśli chcesz wrócić do poprzedniej strony)
  const handleGoBack = () => {
    navigate(-1); // cofa do poprzedniej strony w historii
  };

  return (
    <div className="generated-playlist-container">
      <h1>Your Generated Playlist</h1>

      {/* Tabela z playlistą */}
      {uniquePlaylist.length === 0 ? (
        <p>No songs in this playlist yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Track Name</th>
              <th>Artists</th>
              <th>Danceability</th>
              <th>Energy</th>
              <th>Popularity</th>
            </tr>
          </thead>
          <tbody>
            {uniquePlaylist.map((song, index) => (
              <tr key={`${song.track_id}-${index}`}>
                <td>{song.track_name}</td>
                <td>{song.artists}</td>
                <td>{song.danceability}</td>
                <td>{song.energy}</td>
                <td>{song.popularity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Wykres wartości funkcji celu */}
      <div style={{ marginTop: '40px' }}>
        <h2>Objective Function Over Iterations</h2>
        {objectiveValues.length === 0 ? (
          <p>No data available for the objective function.</p>
        ) : (
          <Plot
            data={[
              {
                x: Array.from(
                  { length: objectiveValues.length },
                  (_, i) => i + 1
                ),
                y: objectiveValues,
                type: 'scatter',
                mode: 'lines+markers',
                marker: { color: '#007bff' },
                line: { shape: 'spline' },
              },
            ]}
            layout={{
              title: 'Objective Function vs Iterations',
              xaxis: { title: 'Iterations' },
              yaxis: { title: 'Objective Value' },
              paper_bgcolor: '#2c2f33',
              plot_bgcolor: '#2c2f33',
              font: { color: '#ffffff' },
              margin: { l: 40, r: 40, b: 40, t: 40 },
            }}
            style={{ width: '100%', height: '400px' }}
          />
        )}
      </div>

      {/* Wykres temperatury */}
      <div style={{ marginTop: '40px' }}>
        <h2>Temperature Over Iterations</h2>
        {temperatures.length === 0 ? (
          <p>No data available for the temperature.</p>
        ) : (
          <Plot
            data={[
              {
                x: Array.from({ length: temperatures.length }, (_, i) => i + 1),
                y: temperatures,
                type: 'scatter',
                mode: 'lines+markers',
                marker: { color: '#ff5555' },
                line: { shape: 'spline' },
              },
            ]}
            layout={{
              title: 'Temperature vs Iterations',
              xaxis: { title: 'Iterations' },
              yaxis: { title: 'Temperature' },
              paper_bgcolor: '#2c2f33',
              plot_bgcolor: '#2c2f33',
              font: { color: '#ffffff' },
              margin: { l: 40, r: 40, b: 40, t: 40 },
            }}
            style={{ width: '100%', height: '400px' }}
          />
        )}
      </div>

      {/* Przyciski */}
      <div style={{ marginTop: '20px' }}>
        <button onClick={handleSendToSpotify}>Send to Spotify</button>
        <button onClick={handleGoBack} style={{ marginLeft: '10px' }}>
          Go Back
        </button>
      </div>
    </div>
  );
};

export default GeneratedPlaylist;
