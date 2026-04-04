# Setup Google Drive com backend

## 1. Criar o arquivo `.env`

Copie `.env.example` para `.env` e preencha:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Para rodar localmente, use:

- `APP_ORIGIN=http://localhost:3000`
- `GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-drive/oauth/callback`

## 2. Configurar no Google Cloud

No OAuth Client Web application, adicione:

- `http://localhost:3000` em **Authorized JavaScript origins**
- `http://localhost:3000/api/google-drive/oauth/callback` em **Authorized redirect URIs**

## 3. Rodar o projeto

Precisa de Node 18 ou superior.

Comando:

```bash
npm start
```

Depois abra:

```text
http://localhost:3000
```

## 4. Conectar o Google Drive

No dashboard:

- faça login
- clique em `Sincronizar Google Drive`
- autorize a conta uma vez

Depois disso, o backend passa a renovar o acesso sem popup recorrente.

## 5. Onde os tokens ficam

Os dados de conexao ficam em:

```text
.data/google-drive-connections.json
```

Esse arquivo foi colocado no `.gitignore`.
