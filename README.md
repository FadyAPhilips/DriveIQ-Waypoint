# DriveIQ-Waypoint

## Setup

### Backend

```bash
cd backend
npm install
npx cdk deploy
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Put the ApiUrl output of BackendStack into .env.local, then:
npm start
```

Open the project in Expo Go on a physical device, or press `i` for the iOS simulator.

`EXPO_PUBLIC_API_URL` is inlined at build time. After editing `.env.local`, do a
full in-app reload (shake, then Reload) rather than a fast refresh.
