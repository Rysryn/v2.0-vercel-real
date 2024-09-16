import { stringify } from 'querystring';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://v2-0-vercel-real.vercel.app';

export default function handler(req, res) {
  const { method } = req;

  switch (method) {
    case 'GET':
      const scope = 'user-read-currently-playing user-read-playback-state';
      res.redirect('https://accounts.spotify.com/authorize?' +
        stringify({
          response_type: 'code',
          client_id: CLIENT_ID,
          scope: scope,
          redirect_uri: REDIRECT_URI,
        }));
      break;
    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}