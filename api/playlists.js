const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = async function handler(req, res) {
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

  // Fetch playlists
  const plRes = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!plRes.ok) {
    const errText = await plRes.text();
    return res.status(500).json({ error: 'Failed to fetch playlists', detail: errText });
  }

  const plData = await plRes.json();

  // Load visibility config — try multiple paths
  let configMap = {};
  try {
    const paths = [
      join(process.cwd(), 'playlist-config.json'),
      join(__dirname, '..', 'playlist-config.json'),
    ];
    for (const p of paths) {
      try {
        const raw = readFileSync(p, 'utf-8');
        const config = JSON.parse(raw);
        config.forEach(item => { configMap[item.id] = item.visible; });
        break;
      } catch (e) { continue; }
    }
  } catch (e) {
    configMap = {};
  }

  const playlists = (plData.items || [])
    .filter(pl => {
      if (!pl) return false;
      if (pl.id in configMap) return configMap[pl.id] === true;
      return true;
    })
    .map(pl => ({
      id: pl.id,
      name: pl.name,
      description: pl.description || '',
      tracks: pl.tracks ? pl.tracks.total : 0,
      image: pl.images && pl.images[0] ? pl.images[0].url : null,
      url: pl.external_urls ? pl.external_urls.spotify : '#',
    }));

  return res.status(200).json({ playlists });
};
