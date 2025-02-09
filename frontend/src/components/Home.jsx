// File: src/components/Home.jsx
import React from 'react';

const Home = () => {
    const handleLogin = () => {
        // Redirect to Flask backend's login route
        window.location.href = 'http://localhost:5000/login';
    };

    return (
        <div className="home-container">
            <h1>Spotify Playlist Creator</h1>
            <button onClick={handleLogin} className="login-button">
                Log in with Spotify
            </button>
        </div>
    );
};

export default Home;
