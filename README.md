# 🧠 POT Quiz — Blockchain Trivia Game on Portaldot

A blockchain-integrated trivia game built on the **Portaldot Network** for Hackathon Season 1, by **Samiecharl** (Solo Builder, Nigeria).

---

## 🎯 Problem Statement

Blockchain education is a major barrier to adoption. Most people don't understand what Layer 0, RWA, staking, or cross-chain bridges mean — and there's no fun, incentivised way to learn. Most blockchain apps also don't give everyday users a reason to interact with the chain beyond speculation.

## ✅ Solution

POT Quiz turns blockchain education into a game. Players answer trivia questions about blockchain and Portaldot, earn real **POT tokens** for correct answers, and compete on a live leaderboard. Every final score is permanently recorded on the Portaldot blockchain.

---

## ⛓ How Portaldot Is Used

POT Quiz integrates directly with the Portaldot network via **native Substrate pallets** using `@polkadot/api`. No custom smart contract is required — the chain's built-in functionality is used throughout:

| Action | Pallet Used | What Happens On-Chain |
|---|---|---|
| Save final score | `system.remark` | Score written permanently to a block as `POTQUIZ:<name>:<score>/<total>:BLOCK<n>` |
| Pay bonus to winner | `balances.transferKeepAlive` | Real POT tokens sent from admin wallet to winner's address |
| Read balance | `system.account` | Player's live POT balance fetched from chain state |

> **Note:** The Portaldot node at the time of this hackathon does not expose a contracts pallet (ink! contracts API). POT Quiz therefore uses native pallets directly — which are fully supported, production-grade, and cover all the app's on-chain needs.

---

## 🏆 Features

- 🎮 Timed trivia quiz with customizable questions, timer and round length
- 🏆 Live leaderboard synced via Firebase Realtime Database
- ⛓ On-chain score proof — every final score written to Portaldot via `system.remark`
- 🎁 Bonus prize system — admin sets score threshold and reward amount
- 💸 Admin sends real POT directly to winners via `balances.transferKeepAlive`
- 🔒 Password-protected admin panel
- 📤 Share score button generates a ready-made social post
- 👋 Welcome screen with player name input
- ⚙️ Full admin panel — add/delete questions, set timer, set bonus rewards, schedule quiz open/close

---

## 🛠 Tech Stack

- **React + Vite** — frontend
- **@polkadot/api** — blockchain connection and native pallet calls
- **@polkadot/extension-dapp** — Polkadot.js wallet integration
- **Firebase Realtime Database** — live leaderboard and claim tracking
- **Portaldot Node** — Substrate-based blockchain (local dev mode)
- **Netlify** — frontend deployment

---

## 🚀 How to Run Locally

### Prerequisites

- Node.js v20+
- Portaldot node binary
- Polkadot.js browser extension

### 1. Start the Portaldot node

```bash
cd ~/portaldot-testnet-ubuntu
./portaldot_dev --dev --force-authoring --rpc-external --ws-external --rpc-cors all
```

### 2. Install dependencies and start the app

```bash
cd game
npm install
npm run dev -- --port 5174
```

### 3. Open in browser

```
http://localhost:5174
```

### 4. Connect wallet

Install the [Polkadot.js extension](https://polkadot.js.org/extension), create an account, and fund it from Alice on the local node at `ws://127.0.0.1:9944`.

---

## 🎬 Demo Video

[Watch the demo](https://jam.dev/c/d3e28bd2-7779-4f1d-ae04-c2bdb482e56b)

---

## 🔍 How Scores Are Verified On-Chain

Every completed quiz writes a remark to the Portaldot blockchain in this format:

```
POTQUIZ:<player_name>:<score>/<total>:BLOCK<block_number>
```

The app scans recent blocks and parses these remarks to build the on-chain leaderboard — meaning scores are **publicly verifiable** by anyone with access to the node, without trusting the app or Firebase.

---

## 👤 Team

**Samiecharl** — Solo Builder, Nigeria

## 📄 License

MIT