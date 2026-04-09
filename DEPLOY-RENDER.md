# Deploy no Render

## O que mudou

Este projeto agora pode rodar no Render como um unico servico Node:

- o frontend continua sendo servido pelo `server.js`
- o arquivo `/google-config.js` passa a ser gerado pelo backend
- o login Google e o Google Drive usam as variaveis de ambiente do servidor

## Passo a passo

1. Suba este repositorio para o GitHub.
2. No Render, crie um `Web Service` apontando para o repositorio.
3. Use:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Defina as variaveis de ambiente:
   - `APP_ORIGIN=https://SEU-APP.onrender.com`
   - `GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_SECRET=seu-client-secret`
   - `GOOGLE_REDIRECT_URI=https://SEU-APP.onrender.com/api/google-drive/oauth/callback`
5. Faça o deploy.

## Google Cloud

No Google Cloud Console, atualize o OAuth Client Web com:

- Authorized JavaScript origins:
  - `https://SEU-APP.onrender.com`
- Authorized redirect URIs:
  - `https://SEU-APP.onrender.com/api/google-drive/oauth/callback`

## Observacoes

- O GitHub Pages nao atende este projeto porque ele nao executa `server.js`.
- Se frontend e backend estiverem no mesmo dominio do Render, deixe `backendBaseUrl` vazio.
- No plano gratuito, o Render pode colocar o servico para dormir quando ficar inativo.
