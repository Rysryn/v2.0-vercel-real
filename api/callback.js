import { stringify } from 'querystring';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://your-vercel-app-name.vercel.app/api/callback';

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    res.redirect('/?error=invalid_code');
    return;
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
      },
      body: stringify({
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const data = await response.json();

    if (data.error) {
      res.redirect(`/?error=${data.error}`);
    } else {
      res.redirect(`/?access_token=${data.access_token}&refresh_token=${data.refresh_token}&expires_in=${data.expires_in}`);
    }
  } catch (error) {
    console.error('Error in callback:', error);
    res.redirect('/?error=server_error');
  }
}