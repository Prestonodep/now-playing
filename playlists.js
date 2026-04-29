import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return res.status(500).json({ error: 'Not configured' });
  }

  // Get access token
  const credentials = Buffer.from(clientId + ':' + clientSecret).toString('base64');
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + credentials,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return res.status(401).json({ error: 'Token refresh failed' });
  }

  // Fetch all user playlists (up to 50)
  const plRes = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!plRes.ok) {
    return res.status(500).json({ error: 'Failed to fetch playlists' });
  }

  const plData = await plRes.json();

  // Load visibility config
  let config = [];
  try {
    const configPath = join(process.cwd(), 'playlist-config.json');
    const raw = readFileSync(configPath, 'utf-8');
    config = JSON.parse(raw);
  } catch (e) {
    // If no config file exists yet, show all playlists
    config = [];
  }

  const configMap = {};
  config.forEach(item => { configMap[item.id] = item.visible; });

  const playlists = plData.items
    .filter(pl => {
      // If playlist is in config, respect its visible flag
      // If not in config at all, show it by default
      if (pl.id in configMap) return configMap[pl.id] === true;
      return true;
    })
    .map(pl => ({
      id: pl.id,
      name: pl.name,
      description: pl.description,
      tracks: pl.tracks.total,
      image: pl.images?.[0]?.url || null,
      url: pl.external_urls.spotify,
    }));

  return res.status(200).json({ playlists });
}
