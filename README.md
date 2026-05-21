# 🧠 POT Quiz — Blockchain Trivia Game on Portaldot

> A blockchain-integrated trivia game built on the **Portaldot Network** for Hackathon Season 1, by **Samiecharl** (Solo Builder, Nigeria).

---

## 🎯 Problem Statement

Blockchain education is a major barrier to mass adoption. Most people don't understand what Layer 0, RWA, staking, or cross-chain bridges mean — and there's no fun, incentivised way to learn. At the same time, most blockchain apps don't give everyday users a reason to interact with the chain beyond speculation.

POT Quiz solves both problems: it makes blockchain literacy fun and rewarding, while giving real users a genuine reason to connect a wallet, sign transactions, and earn real tokens — all on Portaldot.

---

## ✅ Solution

POT Quiz turns blockchain education into a competitive trivia game. Players answer questions about blockchain concepts and the Portaldot ecosystem, earn real **POT tokens** for correct answers, and compete on a live leaderboard. Every final score is permanently recorded on the Portaldot blockchain — publicly verifiable by anyone.

**Core innovations:**
- On-chain score proof via `system.remark` — no custom contract needed
- Real POT token payouts to winners via `balances.transferKeepAlive`
- Live leaderboard backed by Firebase, cross-verified against chain data
- Fully admin-configurable quiz (questions, timer, bonus, schedule)

---

## ⛓ Blockchain Relevance

POT Quiz integrates directly with the Portaldot network using **native Substrate pallets** via `@polkadot/api`. No custom smart contract is required — the chain's built-in functionality handles all on-chain operations:

| Action | Pallet Used | What Happens On-Chain |
|---|---|---|
| Save final score | `system.remark` | Score written permanently to a block as `POTQUIZ:<name>:<score>/<total>:BLOCK<n>` |
| Pay bonus to winner | `balances.transferKeepAlive` | Real POT tokens sent from admin wallet to winner's address |
| Read live balance | `system.account` | Player's POT balance fetched live from chain state |

> **Note:** The Portaldot node at the time of this hackathon does not expose an ink! contracts pallet. POT Quiz uses native pallets directly — which are fully production-grade and cover all on-chain needs without a custom contract.

Every score remark is publicly verifiable. The app scans recent blocks and parses remarks matching the `POTQUIZ:` format to rebuild the leaderboard directly from chain data, meaning **Firebase is a cache, not the source of truth**.

---

## 🏗 Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Player's Browser                     │
│                                                         │
│   React + Vite Frontend                                 │
│   ┌──────────────┐   ┌──────────────┐                  │
│   │  Quiz UI     │   │  Admin Panel │                  │
│   │  Leaderboard │   │  Claim Mgmt  │                  │
│   └──────┬───────┘   └──────┬───────┘                  │
│          │                  │                           │
│   ┌──────▼──────────────────▼───────┐                  │
│   │       @polkadot/extension-dapp  │                  │
│   │       (Wallet Signer)           │                  │
│   └──────────────┬──────────────────┘                  │
└──────────────────┼──────────────────────────────────────┘
                   │
        ┌──────────▼──────────┐        ┌──────────────────┐
        │   @polkadot/api     │        │  Firebase        │
        │   WebSocket RPC     │        │  Realtime DB     │
        └──────────┬──────────┘        │  - leaderboard   │
                   │                   │  - claims        │
        ┌──────────▼──────────┐        │  - settings      │
        │   Portaldot Node    │        │  - questions     │
        │   (Substrate)       │        └──────────────────┘
        │                     │
        │  system.remark      │  ← Score proof written here
        │  balances.transfer  │  ← Bonus POT sent here
        │  system.account     │  ← Balance read from here
        └─────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Blockchain Platform** | Portaldot Network (Substrate-based) |
| **Smart Contract Language** | N/A — uses native Substrate pallets (`system`, `balances`) |
| **Frontend Framework** | React 18 + Vite |
| **Blockchain API** | @polkadot/api (WebSocket RPC) |
| **Wallet Integration** | @polkadot/extension-dapp (Polkadot.js browser extension) |
| **Realtime Database** | Firebase Realtime Database (leaderboard, claims, admin settings) |
| **Deployment** | Netlify |

---

## 📁 Project Structure

```
portaldot-hackathon-2026-potquiz-samiecharl/
├── public/
│   └── logo.png
├── src/
│   └── App.jsx          # Main app — all game logic, UI, blockchain calls
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## 📜 Smart Contracts

**Not applicable.** The Portaldot node used in this hackathon does not expose an ink! contracts pallet. POT Quiz achieves all on-chain functionality using native Substrate pallets:

- **`system.remark(data)`** — writes the player's score permanently to the blockchain
- **`balances.transferKeepAlive(dest, value)`** — sends real POT token bonus to qualifying players
- **`system.account(address)`** — reads live POT balance from chain state

These pallets are production-grade, require no deployment, and are natively available on all Substrate-based chains including Portaldot.

---

## 🚀 Installation & Setup

### Requirements

- Node.js v20+
- Portaldot node binary (provided separately by hackathon organisers)
- [Polkadot.js browser extension](https://polkadot.js.org/extension)

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/Samiecharl/portaldot-hackathon-2026-potquiz-samiecharl.git
cd portaldot-hackathon-2026-potquiz-samiecharl
```

**2. Start the Portaldot node**
```bash
cd ~/portaldot-testnet-ubuntu
./portaldot_dev --dev --force-authoring --rpc-external --ws-external --rpc-cors all
```
Node will be available at `ws://127.0.0.1:9944`

**3. Install dependencies**
```bash
cd game
npm install
```

**4. Launch the frontend**
```bash
npm run dev -- --port 5174
```
Open `http://localhost:5174` in your browser.

**5. Connect wallet**

Install the Polkadot.js extension, create an account, and fund it from the Alice dev account using the local node at `http://localhost:9944` (Polkadot.js Apps or similar tool).

> **Firebase is pre-configured** — no setup needed. The app connects to the shared Firebase project automatically.

---

## 🎬 Demo

- **Demo Video:** [Watch on Jam](https://jam.dev/c/d3e28bd2-7779-4f1d-ae04-c2bdb482e56b)
- **Live Demo:** [portaldotquiz.netlify.app](https://portaldotquiz.netlify.app)

### Test Data

To test locally without a funded wallet:
- Use the Alice dev account (pre-funded on any `--dev` Substrate node)
- Address: `5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY`

---

## 🏆 Features

- 🎮 Timed trivia quiz with configurable questions, timer, and round length
- ⛓ On-chain score proof — every final score written to Portaldot via `system.remark`
- 🏆 Live leaderboard synced in real-time via Firebase, cross-verifiable from chain
- 🎁 Bonus prize system — admin configures score threshold and reward amount
- 💸 Admin sends real POT directly to winners' wallets via `balances.transferKeepAlive`
- ⏰ Quiz scheduling — manual open/close, countdown timer, or exact datetime
- 🔒 Password-protected admin panel
- 📤 Share score button generates a ready-made social post
- ⚙️ Full admin panel — add/delete questions, set timer, set bonus rewards

---

## 🗺 Roadmap

### ✅ Completed (Hackathon Season 1)
- On-chain score saving via `system.remark`
- Real POT bonus payouts via `balances.transferKeepAlive`
- Live leaderboard (Firebase + on-chain scan)
- Admin panel with quiz scheduling, question management, and bonus claims
- Wallet connection via Polkadot.js extension
- Netlify deployment

### 🔜 Next Phase
- Custom ink! smart contract for trustless, automated bonus payouts (removing admin middleman)
- NFT badge minting for top scorers each round
- Multi-round tournament mode with bracket system
- Mobile-optimised UI
- Integration with Portaldot identity pallet for verified player names
- DAO-style question submission — community proposes and votes on new questions

---

## 👤 Team

| Name | Role | Location |
|---|---|---|
| **Samiecharl** | Solo Builder — Full Stack & Blockchain | Nigeria |

**Contact:** Open a GitHub issue on this repo for hackathon communication, or reach out via the Portaldot Discord.

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.