import React, { useState, useRef, useEffect } from 'react';
import Plot from 'react-plotly.js'; // biblioteka do wykresu 3D
import axios from 'axios';
import './SelectSongs.css';
import { useNavigate } from 'react-router-dom';

/** Funkcje pomocnicze - te same co wcześniej */
function triangleArea(A, B, C) {
  return Math.abs(
    (A.x * (B.y - C.y) +
     B.x * (C.y - A.y) +
     C.x * (A.y - B.y)) / 2
  );
}

function isPointInTriangle(P, A, B, C) {
  const areaABC = triangleArea(A, B, C);
  const areaPBC = triangleArea(P, B, C);
  const areaAPC = triangleArea(A, P, C);
  const areaABP = triangleArea(A, B, P);

  const epsilon = 0.00001;
  return Math.abs(areaPBC + areaAPC + areaABP - areaABC) < epsilon;
}

function getBarycentricCoords(P, A, B, C) {
  const areaABC = triangleArea(A, B, C);
  if (areaABC === 0) return undefined; // Zabezpieczenie: jeśli trójkąt ma pole = 0

  const areaPBC = triangleArea(P, B, C);
  const areaAPC = triangleArea(A, P, C);
  const areaABP = triangleArea(A, B, P);

  const alpha = areaPBC / areaABC;
  const beta  = areaAPC / areaABC;
  const gamma = areaABP / areaABC;

  return { alpha, beta, gamma };
}

function clampPointToTriangle(P, A, B, C) {
  // Jeśli punkt już w środku, zwracamy P
  if (isPointInTriangle(P, A, B, C)) {
    return P;
  }

  // W przeciwnym wypadku "przycinamy" do najbliższego punktu na krawędziach
  const edges = [
    [A, B],
    [B, C],
    [C, A],
  ];

  let minDist = Infinity;
  let closestPoint = { ...P };

  const dist = (p1, p2) =>
    Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

  function projectPointOnSegment(P, A, B) {
    const AB = { x: B.x - A.x, y: B.y - A.y };
    const AP = { x: P.x - A.x, y: P.y - A.y };
    const ab2 = AB.x * AB.x + AB.y * AB.y;
    if (ab2 === 0) return A; // edge case: A i B to to samo miejsce

    const t = Math.max(0, Math.min(1, (AP.x * AB.x + AP.y * AB.y) / ab2));
    return {
      x: A.x + AB.x * t,
      y: A.y + AB.y * t,
    };
  }

  edges.forEach(([X, Y]) => {
    const candidate = projectPointOnSegment(P, X, Y);
    const distance = dist(P, candidate);
    if (distance < minDist) {
      minDist = distance;
      closestPoint = candidate;
    }
  });

  return closestPoint;
}

const SelectSongs = () => {
  // --- Wierzchołki trójkąta (lewa kolumna) ---
  const A = { x: 100, y: 0 };
  const B = { x: 0,   y: 200 };
  const C = { x: 200, y: 200 };

  // --- Barycentryczne wagi ---
  const [alpha, setAlpha] = useState(1 / 3);
  const [beta,  setBeta ] = useState(1 / 3);
  const [gamma, setGamma] = useState(1 / 3);

  // --- Parametry playlisty / SA (lewa kolumna) ---
  const [accessToken, setAccessToken] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [numSongs, setNumSongs] = useState(0);
  const [initialTemp, setInitialTemp] = useState(1000);
  const [coolingRate, setCoolingRate] = useState(0.95);
  const [maxIterations, setMaxIterations] = useState(1000);

  // --- Wczytanie accessToken z query, jeśli istnieje ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('access_token');
    if (token) {
      setAccessToken(token);
    }
  }, []);

  // --- Utrzymujemy listę WYBRANYCH utworów (track_id) ---
  const [selectedTracks, setSelectedTracks] = useState([]);

  // --- Dodatkowo przechowujemy szczegółowe dane o wybranych utworach
  // (danceability, energy, popularity itp.) – do wykresu 3D
  const [selectedSongDetails, setSelectedSongDetails] = useState([]);

  // --- Obsługa trójkąta (drag) w lewej kolumnie ---
  const triangleRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const markerPos = {
    x: alpha * A.x + beta * B.x + gamma * C.x,
    y: alpha * A.y + beta * B.y + gamma * C.y,
  };

  const onMouseDown = () => setIsDragging(true);
  const onMouseUp = () => setIsDragging(false);

  const onMouseMove = (e) => {
    if (!isDragging) return;
    if (!triangleRef.current) return;

    const rect = triangleRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    let P = { x: offsetX, y: offsetY };
    P = clampPointToTriangle(P, A, B, C);

    const coords = getBarycentricCoords(P, A, B, C);
    if (!coords) return; // awaryjne wyjście, gdyby trójkąt był osobliwy

    const { alpha: a, beta: b, gamma: g } = coords;
    setAlpha(a);
    setBeta(b);
    setGamma(g);
  };

  // --- Prawa kolumna: WYSZUKIWANIE piosenek ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSongs = async (p = 1) => {
    if (!searchQuery) return;
    try {
      const res = await axios.get('/search', {
        params: {
          query: searchQuery,
          page: p
        }
      });
      setSearchResults(res.data.results);
      setTotalResults(res.data.total_results);
      setPage(res.data.page);
      setTotalPages(res.data.total_pages);
    } catch (error) {
      console.error("Error searching songs:", error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchSongs(1);
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchSongs(nextPage);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      const prevPage = page - 1;
      setPage(prevPage);
      fetchSongs(prevPage);
    }
  };

  // Dodanie/usunięcie piosenki do selectedTracks i selectedSongDetails
  const toggleTrack = (song) => {
    const trackId = song.track_id;
    setSelectedTracks(prev => {
      if (prev.includes(trackId)) {
        // usuwamy z listy
        return prev.filter(id => id !== trackId);
      } else {
        // dodajemy do listy
        return [...prev, trackId];
      }
    });

    // Zaktualizujmy szczegóły
    setSelectedSongDetails(prev => {
      // Jeśli już jest - usuń
      if (prev.find(s => s.track_id === trackId)) {
        return prev.filter(s => s.track_id !== trackId);
      }
      // W innym wypadku - dodaj
      return [...prev, {
        track_id: trackId,
        track_name: song.track_name,
        artists: song.artists,
        // Zakładamy, że w /search mamy też te pola:
        genre: song.genre,         
        danceability: song.danceability,
        energy: song.energy,
        popularity: song.popularity
      }];
    });
  };

  const navigate = useNavigate();

  const generatePlaylist = async () => {
    try {
      console.log("Generating playlist with:", {
        access_token: accessToken,
        playlist_name: playlistName,
        selected_tracks: selectedTracks,
        num_songs: numSongs,
        initial_temp: initialTemp,
        cooling_rate: coolingRate,
        max_iterations: maxIterations,
        weights: [alpha, beta, gamma],
      });
  
      const weights = [alpha, beta, gamma];
      const res = await axios.post('/generate_playlist', {
        access_token: accessToken,
        playlist_name: playlistName,
        selected_tracks: selectedTracks,
        num_songs: numSongs,
        initial_temp: initialTemp,
        cooling_rate: coolingRate,
        max_iterations: maxIterations,
        weights,
      });
  
      const { playlist: generatedPlaylist, objectiveValues } = res.data;
  
      // Przekazujemy wygenerowaną playlistę oraz dane funkcji celu
      navigate('/generated_playlist', {
        state: {
          playlist: generatedPlaylist, // Tablica piosenek
          accessToken: accessToken,
          playlistName: playlistName,
          objectiveValues: objectiveValues, // Wartości funkcji celu
        },
      });
  
    } catch (error) {
      console.error("Error generating playlist:", error);
      alert("Could not generate playlist.");
    }
  };

  // Przygotowujemy dane do 3D scatter plot
  const xValues = selectedSongDetails.map(s => s.danceability || 0);
  const yValues = selectedSongDetails.map(s => s.energy || 0);
  const zValues = selectedSongDetails.map(s => s.popularity || 0);
  const labels  = selectedSongDetails.map(s => `${s.track_name} (${s.artists})`);

  return (
    <div className="page-container">

      {/* --- LEWA KOLUMNA --- */}
      <div className="left-column">
        <h1>Generate Optimal Playlist</h1>
        
        {/* Przycisk "Generate Playlist" przeniesiony na górę */}
        <button onClick={generatePlaylist} className="generate-button">
          Generate Playlist
        </button>

        <div className="input-row">
          <label>Playlist Name</label>
          <input
            type="text"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            placeholder="e.g. My Cool Playlist"
          />
        </div>
        <div className="input-row">
          <label>Number of Songs</label>
          <input
            type="number"
            value={numSongs}
            onChange={(e) => setNumSongs(parseInt(e.target.value) || 0)}
            placeholder="e.g. 10"
            min="1"
          />
        </div>
        <div className="input-row">
          <label>Initial Temp</label>
          <input
            type="number"
            value={initialTemp}
            onChange={(e) => setInitialTemp(parseInt(e.target.value) || 0)}
            placeholder="1000"
          />
        </div>
        <div className="input-row">
          <label>Cooling Rate</label>
          <input
            type="number"
            step="0.01"
            value={coolingRate}
            onChange={(e) => setCoolingRate(parseFloat(e.target.value) || 0)}
            placeholder="0.95"
          />
        </div>
        <div className="input-row">
          <label>Max Iterations</label>
          <input
            type="number"
            value={maxIterations}
            onChange={(e) => setMaxIterations(parseInt(e.target.value) || 0)}
            placeholder="1000"
          />
        </div>

        <h3>Set Weights (Drag Marker in Triangle)</h3>
        <div
          className="triangle-container"
          ref={triangleRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        >
                <svg
          width="200"
          height="220" // Zwiększ wysokość, aby było miejsce na opisy poniżej
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <polygon
            points="100,20 0,200 200,200" // Przesunięcie trójkąta nieco niżej
            fill="#3c4147"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <text
            x="100"
            y="10" // Popularity wyżej
            textAnchor="middle"
            fill="#ffffff"
            className="vertex-label"
          >
            Popularity
          </text>
          <text
            x="0"
            y="215" // Energy niżej pod trójkątem
            textAnchor="start"
            fill="#ffffff"
            className="vertex-label"
          >
            Energy
          </text>
          <text
            x="200"
            y="215" // Danceability niżej pod trójkątem
            textAnchor="end"
            fill="#ffffff"
            className="vertex-label"
          >
            Danceability
          </text>
        </svg>


          <div
            className="marker"
            style={{ top: markerPos.y - 6, left: markerPos.x - 6 }}
          />
        </div>
        <div className="weights-display">
          <p>Popularity : {alpha.toFixed(2)}</p>
          <p>Energy : {beta.toFixed(2)}</p>
          <p>Danceability : {gamma.toFixed(2)}</p>
        </div>

        
      </div>

      {/* --- ŚRODKOWA KOLUMNA: 3D WYKRES --- */}
      <div className="middle-column">
        <h2>3D Chart of Selected Songs</h2>
        {selectedSongDetails.length === 0 ? (
          <p style={{ marginTop: '20px' }}>
            No songs selected yet. Add some from the search (right side).
          </p>
        ) : (
          <Plot
            style={{ width: '400px', height: '500px' }}
            config={{ displayModeBar: false }}
            data={[
              {
                x: xValues,
                y: yValues,
                z: zValues,
                text: labels,
                mode: 'markers',
                type: 'scatter3d',
                marker: {
                  color: '#ff5555',
                  size: 5,
                  symbol: 'circle'
                },
                hovertemplate:
                  '<b>%{text}</b><br>' +
                  'danceability: %{x}<br>' +
                  'energy: %{y}<br>' +
                  'popularity: %{z}<extra></extra>'
              }
            ]}
            layout={{
              paper_bgcolor: '#2c2f33',
              plot_bgcolor: '#2c2f33',
              margin: { l: 0, r: 0, b: 50, t: 0 },
              scene: {
                bgcolor: '#2c2f33',
                xaxis: {
                  title: 'Danceability',
                  titlefont: { color: '#ffffff' },
                  tickfont: { color: '#ffffff' },
                  gridcolor: 'rgba(255,255,255,0.2)',
                  linecolor: '#ffffff',
                  backgroundcolor: '#2c2f33'
                },
                yaxis: {
                  title: 'Energy',
                  titlefont: { color: '#ffffff' },
                  tickfont: { color: '#ffffff' },
                  gridcolor: 'rgba(255,255,255,0.2)',
                  linecolor: '#ffffff',
                  backgroundcolor: '#2c2f33'
                },
                zaxis: {
                  title: 'Popularity',
                  titlefont: { color: '#ffffff' },
                  tickfont: { color: '#ffffff' },
                  gridcolor: 'rgba(255,255,255,0.2)',
                  linecolor: '#ffffff',
                  backgroundcolor: '#2c2f33'
                }
              }
            }}
          />
        )}
      </div>

      {/* --- PRAWA KOLUMNA: WYSZUKIWANIE I WYNIKI (tabela) --- */}
      <div className="right-column">
        <h2>Search Songs</h2>
        <form onSubmit={handleSearch}>
          <div className="search-row">
            <input
              type="text"
              placeholder="Search by track name or artist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit">Search</button>
          </div>
        </form>

        <p>
          Found {totalResults} results
          {totalResults > 0 && ` (page ${page} of ${totalPages})`}
        </p>

        {/* Tabela z wynikami */}
        <div className="search-results-table-container">
          <table>
            <thead>
              <tr>
                <th>Track Name</th>
                <th>Artists</th>
                <th>Genre</th>
                <th>Dance</th>
                <th>Energy</th>
                <th>Popularity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map(song => (
                <tr key={song.track_id}>
                  <td>{song.track_name}</td>
                  <td>{song.artists}</td>
                  <td>{song.genre ?? 'N/A'}</td>
                  <td>{song.danceability ?? 'N/A'}</td>
                  <td>{song.energy ?? 'N/A'}</td>
                  <td>{song.popularity ?? 'N/A'}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => toggleTrack(song)}
                      style={{
                        backgroundColor: selectedTracks.includes(song.track_id)
                          ? 'green'
                          : '#007bff'
                      }}
                    >
                      {selectedTracks.includes(song.track_id) ? 'Added' : 'Add'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginacja */}
        {totalResults > 0 && (
          <div className="pagination">
            <button onClick={handlePrevPage} disabled={page <= 1}>
              Prev
            </button>
            <span className="page-info">{page}/{totalPages}</span>
            <button onClick={handleNextPage} disabled={page >= totalPages}>
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectSongs;
