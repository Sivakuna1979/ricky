# Life Story: launch guide

Life Story turns old photos and a short conversation into a narrated documentary film about
someone's life, for birthdays, anniversaries, weddings, retirements and memorials.

It has three parts:

| Part | Folder | Runs on | What it does |
|---|---|---|---|
| Phone app | `apps/lifestory-mobile` | App Store + Google Play | Photos, interview, script review, payment, watch & share |
| API | `apps/lifestory-api` | Vercel | Claude interview + script writing, payment check |
| Render worker | `apps/lifestory-api` (Dockerfile) | Railway | Voice-over, music and video rendering |
| Database & files | `apps/lifestory-api/supabase` | Supabase | Films, photos, finished videos (private) |

## How a film is made

1. The person names who the film is about, the occasion and the narration language.
2. They add 3–40 photos, with optional notes like "Wedding day, 1968".
3. Claude interviews them, one gentle question at a time (about 6–10 questions).
4. Claude looks at every photo and the answers, then writes a script: scenes, narration and captions.
   It uses only facts the family gave and never makes up names or dates.
5. They edit any words, pick a narrator voice and the shape (TV or phone), then pay in the app.
6. The worker records the narration (ElevenLabs) and renders a Full HD film with slow zooms,
   crossfades, captions, a title card and music. The person gets a notification when it's ready.
7. They watch it, share it (WhatsApp, AirPlay, etc.) and save it to Photos.

## Launch checklist

You need these accounts. You already have Apple and Google developer accounts.

| Account | Cost | Used for |
|---|---|---|
| [Supabase](https://supabase.com) | Free to start | Database, sign-in, file storage |
| [Vercel](https://vercel.com) | Free to start | API |
| [Railway](https://railway.com) | ~$5–20/month | Render worker (needs ffmpeg, so it can't run on Vercel) |
| [Anthropic](https://console.anthropic.com) | Pay per use | Claude (interview + script) |
| [ElevenLabs](https://elevenlabs.io) | from ~$22/month | Narration voices (30+ languages incl. Tamil, Hindi) |
| [RevenueCat](https://www.revenuecat.com) | Free under $2.5k/month revenue | In-app purchases on both stores |
| [Expo](https://expo.dev) | Free tier works | Builds the iPhone/Android apps in the cloud and submits them |

### 1. Supabase (database and storage)
1. Create a project.
2. Open **SQL Editor**, paste `apps/lifestory-api/supabase/migrations/20261020000000_lifestory.sql` and run it.
   This creates the tables, the security rules, and the private `lifestory` storage bucket.
3. **Authentication → Sign In / Providers**: turn on **Anonymous sign-ins**. People can start
   without making an account.
4. **Project Settings → API**: copy the Project URL, the `anon` key and the `service_role` key.
   The `service_role` key is secret; it goes only on the server and worker.

### 2. API on Vercel
New project → import this repo → **Root Directory `apps/lifestory-api`**. Environment variables:

```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
REVENUECAT_SECRET_KEY=sk_...            # RevenueCat → Project settings → API keys (secret)
FILM_PRODUCT_IDS=lifestory_film         # comma-separated store product ids
LIFESTORY_FREE_RENDERS=true             # ONLY while testing; remove before launch
```

Open `https://<your-api>.vercel.app/api/health` to check every service shows as configured.

### 3. Render worker on Railway
New project → deploy from this repo → **Root Directory `apps/lifestory-api`**. It picks up the
`Dockerfile` (ffmpeg + fonts for every language). Environment variables:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
ELEVENLABS_API_KEY=...
```

Give it at least 2 vCPU / 2 GB RAM. A 4-minute film renders in about 6–10 minutes. For more
films at once, run more replicas; they share the queue safely.

### 4. In-app purchase (App Store, Google Play, RevenueCat)
Apple and Google require in-app purchase for digital products like a film. Each film is a
**consumable** purchase.

1. **App Store Connect**: create the app (bundle id `com.lifestoryfilms.app`; change it in
   `app.json` first if you want your own). Under *In-App Purchases*, add a **Consumable** with
   product id `lifestory_film`, price e.g. $39.99. Join the **App Store Small Business Program**
   so Apple takes 15% instead of 30%.
2. **Google Play Console**: create the app (package `com.lifestoryfilms.app`). Under *Monetize →
   In-app products*, add `lifestory_film` at the same price. Google's fee is 15% on your first $1M per year.
3. **RevenueCat**: create a project and add the iOS and Android apps (follow their store-connection
   steps). Add the product to an **Offering** named `default` with one package.
   Copy the public SDK keys (`appl_...`, `goog_...`) for the app and the secret key for the API.

### 5. Build and publish the app with Expo (EAS)
```bash
cd apps/lifestory-mobile
npm install
npx eas-cli@latest login
npx eas-cli@latest init                # links the project and fills in extra.eas.projectId

# App settings (public values only; they're bundled into the app)
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_URL --value https://<your-api>.vercel.app --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_... --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_... --visibility plaintext
# (repeat for --environment preview to make test builds)

npx eas-cli@latest build --platform all --profile production   # builds in the cloud; it will offer to create signing keys
npx eas-cli@latest submit --platform ios                       # uploads to App Store Connect / TestFlight
npx eas-cli@latest submit --platform android                   # uploads to Google Play (needs a Play service-account key)
```

**Test on your own phone first:** `npx eas-cli@latest build --profile preview --platform ios`
(or `android`) and install the build, with `LIFESTORY_FREE_RENDERS=true` on the API. Expo Go
won't work here because in-app purchases need native code.

### 6. Before you submit for review
- **Privacy policy and support URL.** Both stores require them. Say that the photos and answers
  people provide are sent to Anthropic (Claude) and ElevenLabs to make the film, are stored
  privately, and are deleted when the film is deleted.
- **App Privacy** (Apple) / **Data safety** (Google): photos and user content are collected for
  app functionality, not tracking, and are not sold.
- **Review notes** (Apple): explain the flow and that the purchase delivers one film. Give the
  reviewer a promo code or use a sandbox account.
- **Screenshots**: run a real film through and capture the home, interview, script and finished
  film screens.
- Remove `LIFESTORY_FREE_RENDERS` from the API.

## Costs per film (rough)

| | Per film |
|---|---|
| Claude (interview + script with photos) | ~$0.20–0.40 |
| ElevenLabs narration (~3,000 characters) | ~$0.30–0.90 |
| Render worker time | ~$0.05 |
| Storage | pennies |
| **Total** | **~$1–1.50** |

At $39.99, after Apple's or Google's 15% you keep about **$33** per film.

## Developing

```bash
cp .env.example .env     # fill in your Supabase / API values
npm run type-check
npx eas-cli@latest build --profile development --platform ios   # one-time dev build, then:
npx expo start
```

The web build is only for quick UI checks; purchases, push notifications and saving to Photos
work on real phones only.

## Known limits and next steps
- **Accounts are anonymous.** Films live with the phone's session; reinstalling the app loses access.
  Add *Sign in with Apple / Google* (Supabase supports both) so families can move between phones
  and share access.
- **Background music** is a set of soft piano beds generated from scratch by
  `apps/lifestory-api/scripts/make-music.ts` (`npm run music`), so there's no licensing risk. For a more polished
  sound, buy a licence for a few tracks and drop them into `apps/lifestory-api/assets/music/`
  as `gentle.mp3`, `uplifting.mp3` and `nostalgic.mp3`.
- **Voice answers**: let people speak their answers instead of typing (speech-to-text).
- **Family collaboration**: invite siblings to add photos and memories to the same film.
- **Premium tier**: longer films, the relative's own recorded voice clips, a printed DVD/USB keepsake.
