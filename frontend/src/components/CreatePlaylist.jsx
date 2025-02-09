import React, { useState } from 'react';

const CreatePlaylist = () => {
    const [playlistName, setPlaylistName] = useState('');
    const [numSongs, setNumSongs] = useState(1);

    const handleSubmit = (event) => {
        event.preventDefault();
        // Logic to create playlist via API
    };

    return (
        <div className="create-playlist-container">
            <h1>Create a Spotify Playlist</h1>
            <form onSubmit={handleSubmit}>
                <label htmlFor="playlist_name">Playlist Name:</label>
                <input
                    type="text"
                    id="playlist_name"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    required
                />
                <br />
                <label htmlFor="num_songs">Number of Songs:</label>
                <input
                    type="number"
                    id="num_songs"
                    value={numSongs}
                    onChange={(e) => setNumSongs(e.target.value)}
                    min="1"
                    required
                />
                <br />
                <button type="submit">Create Playlist</button>
            </form>
        </div>
    );
};

export default CreatePlaylist;