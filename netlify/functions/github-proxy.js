const fetch = require('node-fetch');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'Neider435';
const GITHUB_REPO = process.env.GITHUB_REPO || 'PAUSASACTIVAS';

exports.handler = async (event, context) => {
  console.log('🔔 Function called:', event.httpMethod, event.path);
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { method, path, body } = JSON.parse(event.body);
    
    console.log('📥 Request:', method, path);
    
    if (!method || !path) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing method or path' })
      };
    }

    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${path}`;
    
    const headers = {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PausasActivas-Inlotrans-Netlify',
      'Content-Type': 'application/json'
    };

    let response;

    if (method === 'GET') {
      console.log('🔍 Fetching:', url);
      response = await fetch(url, { headers });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ GitHub API error:', response.status, errorText);
        return {
          statusCode: response.status,
          body: JSON.stringify({ error: errorText })
        };
      }
      
      const data = await response.json();
      const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
      
      console.log('✅ Success');
      return {
        statusCode: 200,
        body: JSON.stringify({ content, sha: data.sha })
      };
    }
    
    if (method === 'PUT') {
      const { content, sha, message } = body;
      
      if (!content || !sha) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing content or sha' })
        };
      }

      console.log('✏️ Updating:', url);
      response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: message || `Update ${path} via Netlify Function`,
          content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
          sha
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ GitHub API error:', response.status, errorText);
        return {
          statusCode: response.status,
          body: JSON.stringify({ error: errorText })
        };
      }
      
      const result = await response.json();
      console.log('✅ Success');
      return {
        statusCode: 200,
        body: JSON.stringify(result)
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid method' })
    };

  } catch (error) {
    console.error('❌ Error in function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
