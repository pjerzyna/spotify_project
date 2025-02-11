
from flask import Flask, redirect, request, jsonify
import requests
import pandas as pd
from simulated_annealing import PlaylistGenerator

app = Flask(__name__)

# Spotify API Configuration
CLIENT_ID = ""
CLIENT_SECRET = ""
REDIRECT_URI = "http://localhost:5000/callback"

# Load dataset
songs_dataset = pd.read_csv('dataset.csv')

# Zabezpieczenie: jeśli niektóre wartości są NaN, konwertujemy na sensowne typy
# Przykładowo:
songs_dataset['track_name'] = songs_dataset['track_name'].fillna('').astype(str)
songs_dataset['artists'] = songs_dataset['artists'].fillna('').astype(str)

# Jeżeli w CSV kolumna gatunku ma nazwę 'genre', a nie 'track_genre',
# usuń albo zmień odpowiednio poniższą linię. Ważne, byś używał właściwej nazwy.
if 'track_genre' in songs_dataset.columns:
    songs_dataset['track_genre'] = songs_dataset['track_genre'].fillna('').astype(str)
elif 'genre' in songs_dataset.columns:
    songs_dataset['genre'] = songs_dataset['genre'].fillna('').astype(str)

# Dla danceability, energy, popularity - wstaw 0 jeśli brak
for col in ['danceability', 'energy', 'popularity']:
    if col in songs_dataset.columns:
        songs_dataset[col] = pd.to_numeric(songs_dataset[col], errors='coerce').fillna(0)

@app.route('/')
def home():
    return redirect("http://localhost:3000")

@app.route('/login')
def login():
    auth_url = (
        "https://accounts.spotify.com/authorize"
        f"?client_id={CLIENT_ID}&response_type=code"
        f"&redirect_uri={REDIRECT_URI}"
        "&scope=playlist-modify-public"
    )
    return redirect(auth_url)

@app.route('/callback')
def callback():
    code = request.args.get('code')
    if not code:
        return "Error: Authorization code not provided.", 400

    token_url = "https://accounts.spotify.com/api/token"
    payload = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': REDIRECT_URI,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
    }
    response = requests.post(token_url, data=payload)

    if response.status_code != 200:
        return f"Error fetching access token: {response.text}", 400

    tokens = response.json()
    access_token = tokens.get('access_token')

    # Redirect to React app with access token in query params
    return redirect(f"http://localhost:3000/select_songs?access_token={access_token}")

@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('query', '').lower()
    page = int(request.args.get('page', 1))
    per_page = 10

    if not query:
        return jsonify({"error": "Query parameter is required"}), 400

    # Zakładamy, że kolumny w CSV to: track_name, artists, track_genre (lub genre), danceability, energy, popularity
    # Filtrujemy piosenki
    filtered_songs = songs_dataset[
        songs_dataset['track_name'].str.lower().str.contains(query) |
        songs_dataset['artists'].str.lower().str.contains(query)
    ]

    total_results = len(filtered_songs)
    start = (page - 1) * per_page
    end = start + per_page
    paginated_songs = filtered_songs.iloc[start:end]

    results = []
    for _, song in paginated_songs.iterrows():
        # Dopasuj kolumny w zależności od nazwy w CSV:
        # track_genre lub genre
        if 'track_genre' in song:
            current_genre = song['track_genre']
        elif 'genre' in song:
            current_genre = song['genre']
        else:
            current_genre = ''  # brak kolumny

        results.append({
            "track_id": song.get('track_id', ''),
            "track_name": song.get('track_name', ''),
            "artists": song.get('artists', ''),
            "genre": current_genre,
            "danceability": song.get('danceability', 0),
            "energy": song.get('energy', 0),
            "popularity": song.get('popularity', 0),
        })

    return jsonify({
        "results": results,
        "total_results": total_results,
        "page": page,
        "total_pages": (total_results + per_page - 1) // per_page
    })

@app.route('/create_spotify_playlist', methods=['POST'])
def create_spotify_playlist():
    data = request.json
    access_token = data.get('accessToken')
    playlist_name = data.get('playlistName', 'Generated Playlist')
    tracks = data.get('tracks', [])  # to jest lista obiektów piosenek

    if not access_token:
        return jsonify({"error": "Access token is required"}), 400
    
    # KROK 1: tworzenie nowej playlisty (użytkownika)
    create_url = "https://api.spotify.com/v1/users/{user_id}/playlists"
    # Musisz najpierw pobrać user_id z /me, bo user_id jest potrzebne do tworzenia playlist
    me_response = requests.get(
        "https://api.spotify.com/v1/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    if me_response.status_code != 200:
        return jsonify({"error": "Could not fetch user profile"}), 400
    
    user_id = me_response.json().get('id')

    payload = {
        "name": playlist_name,
        "public": True
    }
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    create_response = requests.post(create_url.format(user_id=user_id), json=payload, headers=headers)
    if create_response.status_code != 201:
        return jsonify({"error": f"Could not create playlist: {create_response.text}"}), 400

    playlist_id = create_response.json().get('id')

    # KROK 2: dodawanie utworów
    # W your dataset, 'track_id' prawdopodobnie jest w formacie np. "spotify:track:..."
    # lub samo ID. Musisz przekazać URLe w formacie "spotify:track:ID"
    # załóżmy, że track_id to ID. 
    # W doc. Spotify: POST /v1/playlists/{playlist_id}/tracks?uris=spotify:track:{id1},spotify:track:{id2},...
    track_uris = []
    for song in tracks:
        # => "spotify:track:{song['track_id']}"
        track_uris.append(f"spotify:track:{song['track_id']}")
    
    add_url = f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks"
    add_payload = {
        "uris": track_uris
    }
    add_response = requests.post(add_url, json=add_payload, headers=headers)
    if add_response.status_code not in (201, 200):
        return jsonify({"error": f"Could not add tracks: {add_response.text}"}), 400
    
    return jsonify({"playlist_id": playlist_id, "message": "Playlist created on Spotify!"})


@app.route('/generate_playlist', methods=['POST'])
def generate_playlist():
    try:
        # Pobieranie danych z żądania
        access_token = request.json.get('access_token')
        playlist_name = request.json.get('playlist_name', 'Generated Playlist')
        selected_tracks = request.json.get('selected_tracks', [])
        num_songs = int(request.json.get('num_songs', 0))
        initial_temp = float(request.json.get('initial_temp', 1000))
        cooling_rate = float(request.json.get('cooling_rate', 0.95))
        max_iterations = int(request.json.get('max_iterations', 1000))
        weights = request.json.get('weights', [1, 1, 1])

        if not selected_tracks or num_songs <= 0:
            return jsonify({"error": "Invalid input: No selected tracks or invalid number of songs."}), 400

        selected_indices = songs_dataset[songs_dataset['track_id'].isin(selected_tracks)].index.tolist()
        if not selected_indices:
            return jsonify({"error": "No valid selected tracks provided."}), 400

        generator = PlaylistGenerator(
            dataset=songs_dataset,
            num_songs=num_songs,
            initial_temp=initial_temp,
            cooling_rate=cooling_rate,
            max_iterations=max_iterations
        )

        # Update to unpack three values returned by `generate`
        best_songs, objective_values, temperatures = generator.generate(selected_indices, weights)

        # Return all three outputs
        return jsonify({
            "playlist": best_songs.to_dict(orient="records"),
            "objectiveValues": objective_values,
            "temperatures": temperatures
        })

    except Exception as e:
        print(f"Error in generate_playlist: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    #app.run(debug=True)
    app.run(host="0.0.0.0", port=5000, debug=True)
